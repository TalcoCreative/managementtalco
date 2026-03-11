import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ---- Web Push with VAPID (pure Deno, no npm) ----

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from(rawData, (c) => c.charCodeAt(0));
}

function uint8ArrayToUrlBase64(uint8: Uint8Array): string {
  return btoa(String.fromCharCode(...uint8))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function createVapidJwt(
  audience: string,
  subject: string,
  privateKeyBase64: string,
  expSeconds = 43200
): Promise<string> {
  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = { aud: audience, exp: now + expSeconds, sub: subject };

  const enc = new TextEncoder();
  const headerB64 = uint8ArrayToUrlBase64(enc.encode(JSON.stringify(header)));
  const payloadB64 = uint8ArrayToUrlBase64(enc.encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Import private key
  const privKeyBytes = urlBase64ToUint8Array(privateKeyBase64);
  // Build PKCS8 wrapper around raw 32-byte EC private key
  const pkcs8Header = new Uint8Array([
    0x30, 0x41, 0x02, 0x01, 0x00, 0x30, 0x13, 0x06,
    0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01,
    0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03,
    0x01, 0x07, 0x04, 0x27, 0x30, 0x25, 0x02, 0x01,
    0x01, 0x04, 0x20,
  ]);
  const pkcs8 = new Uint8Array(pkcs8Header.length + privKeyBytes.length);
  pkcs8.set(pkcs8Header);
  pkcs8.set(privKeyBytes, pkcs8Header.length);

  const key = await crypto.subtle.importKey(
    "pkcs8", pkcs8,
    { name: "ECDSA", namedCurve: "P-256" },
    false, ["sign"]
  );

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" }, key,
    enc.encode(unsignedToken)
  );

  // Convert DER signature to raw r||s (64 bytes)
  const sigBytes = new Uint8Array(signature);
  let rawSig: Uint8Array;
  if (sigBytes.length === 64) {
    rawSig = sigBytes;
  } else {
    // Parse DER
    const rLen = sigBytes[3];
    const r = sigBytes.slice(4, 4 + rLen);
    const sOffset = 4 + rLen + 2;
    const sLen = sigBytes[sOffset - 1];
    const s = sigBytes.slice(sOffset, sOffset + sLen);
    rawSig = new Uint8Array(64);
    rawSig.set(r.length > 32 ? r.slice(r.length - 32) : r, 32 - Math.min(r.length, 32));
    rawSig.set(s.length > 32 ? s.slice(s.length - 32) : s, 64 - Math.min(s.length, 32));
  }

  const sigB64 = uint8ArrayToUrlBase64(rawSig);
  return `${unsignedToken}.${sigB64}`;
}

// Encrypt payload using ECDH + HKDF + AES-GCM (RFC 8291)
async function encryptPayload(
  payload: string,
  p256dhKey: string,
  authSecret: string
): Promise<{ encrypted: Uint8Array; salt: Uint8Array; localPublicKey: Uint8Array }> {
  const enc = new TextEncoder();
  const payloadBytes = enc.encode(payload);

  // Generate local ECDH key pair
  const localKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true, ["deriveBits"]
  );
  const localPublicKeyRaw = new Uint8Array(
    await crypto.subtle.exportKey("raw", localKeyPair.publicKey)
  );

  // Import subscriber's public key
  const subscriberKeyBytes = urlBase64ToUint8Array(p256dhKey);
  const subscriberKey = await crypto.subtle.importKey(
    "raw", subscriberKeyBytes,
    { name: "ECDH", namedCurve: "P-256" },
    false, []
  );

  // ECDH shared secret
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: subscriberKey },
      localKeyPair.privateKey, 256
    )
  );

  const authBytes = urlBase64ToUint8Array(authSecret);
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // HKDF helper
  async function hkdf(
    salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number
  ): Promise<Uint8Array> {
    const key = await crypto.subtle.importKey("raw", ikm, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const prk = new Uint8Array(await crypto.subtle.sign("HMAC", key, salt.length ? salt : new Uint8Array(32)));
    const prkKey = await crypto.subtle.importKey("raw", prk, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    // Actually need to use salt as the key for extracting PRK
    const extractKey = await crypto.subtle.importKey("raw", salt.length ? salt : new Uint8Array(32), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const prkActual = new Uint8Array(await crypto.subtle.sign("HMAC", extractKey, ikm));
    const expandKey = await crypto.subtle.importKey("raw", prkActual, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const infoWithCounter = new Uint8Array(info.length + 1);
    infoWithCounter.set(info);
    infoWithCounter[info.length] = 1;
    const okm = new Uint8Array(await crypto.subtle.sign("HMAC", expandKey, infoWithCounter));
    return okm.slice(0, length);
  }

  // RFC 8291 key derivation
  const authInfo = enc.encode("Content-Encoding: auth\0");
  const prkAuth = await hkdf(authBytes, sharedSecret, authInfo, 32);

  const keyInfoBuf = new Uint8Array([
    ...enc.encode("Content-Encoding: aes128gcm\0"),
    ...subscriberKeyBytes,
    ...localPublicKeyRaw,
  ]);
  const contentKey = await hkdf(salt, prkAuth, keyInfoBuf, 16);

  const nonceInfoBuf = new Uint8Array([
    ...enc.encode("Content-Encoding: nonce\0"),
    ...subscriberKeyBytes,
    ...localPublicKeyRaw,
  ]);
  const nonce = await hkdf(salt, prkAuth, nonceInfoBuf, 12);

  // Add padding delimiter
  const paddedPayload = new Uint8Array(payloadBytes.length + 1);
  paddedPayload.set(payloadBytes);
  paddedPayload[payloadBytes.length] = 2; // delimiter

  // Encrypt with AES-128-GCM
  const aesKey = await crypto.subtle.importKey(
    "raw", contentKey, "AES-GCM", false, ["encrypt"]
  );
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce }, aesKey, paddedPayload
    )
  );

  // Build aes128gcm content coding header: salt(16) + rs(4) + idlen(1) + keyid(65) + ciphertext
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, paddedPayload.length + 16 + 1); // record size
  const header = new Uint8Array(16 + 4 + 1 + localPublicKeyRaw.length);
  header.set(salt);
  header.set(rs, 16);
  header[20] = localPublicKeyRaw.length;
  header.set(localPublicKeyRaw, 21);

  const encrypted = new Uint8Array(header.length + ciphertext.length);
  encrypted.set(header);
  encrypted.set(ciphertext, header.length);

  return { encrypted, salt, localPublicKey: localPublicKeyRaw };
}

async function sendPushToEndpoint(
  endpoint: string,
  p256dhKey: string,
  authKey: string,
  payload: object,
  vapidPublicKey: string,
  vapidPrivateKey: string
): Promise<{ success: boolean; status?: number; error?: string }> {
  try {
    const url = new URL(endpoint);
    const audience = `${url.protocol}//${url.host}`;
    const subject = "mailto:admin@talco.id";

    const jwt = await createVapidJwt(audience, subject, vapidPrivateKey);
    const vapidPubBytes = urlBase64ToUint8Array(vapidPublicKey);
    const vapidPubB64 = uint8ArrayToUrlBase64(vapidPubBytes);

    const payloadStr = JSON.stringify(payload);
    const { encrypted } = await encryptPayload(payloadStr, p256dhKey, authKey);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "aes128gcm",
        "TTL": "86400",
        "Authorization": `vapid t=${jwt}, k=${vapidPubB64}`,
        "Urgency": "high",
      },
      body: encrypted,
    });

    if (response.status === 410 || response.status === 404) {
      return { success: false, status: response.status, error: "subscription_expired" };
    }

    const text = await response.text();
    if (!response.ok) {
      console.error(`[WebPush] Failed ${response.status}: ${text}`);
      return { success: false, status: response.status, error: text };
    }

    return { success: true, status: response.status };
  } catch (err) {
    console.error("[WebPush] Error sending:", err);
    return { success: false, error: err.message };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { user_id, user_ids, title, body, url, tag, data: extraData } = await req.json();

    const targetUserIds: string[] = user_ids || (user_id ? [user_id] : []);
    if (targetUserIds.length === 0) {
      return new Response(
        JSON.stringify({ error: "user_id or user_ids required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get VAPID keys
    const { data: vapidSettings } = await supabase
      .from("company_settings")
      .select("setting_key, setting_value")
      .in("setting_key", ["vapid_public_key", "vapid_private_key"]);

    const vapidPublicKey = vapidSettings?.find(s => s.setting_key === "vapid_public_key")?.setting_value;
    const vapidPrivateKey = vapidSettings?.find(s => s.setting_key === "vapid_private_key")?.setting_value;

    if (!vapidPublicKey || !vapidPrivateKey) {
      return new Response(
        JSON.stringify({ error: "VAPID keys not configured. Call get-vapid-key first." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all active subscriptions for target users
    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select("*")
      .in("user_id", targetUserIds)
      .eq("is_active", true);

    if (subError) {
      console.error("[WebPush] Subscription query error:", subError);
      return new Response(
        JSON.stringify({ error: subError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "No active subscriptions" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pushPayload = {
      title: title || "Talco Management System",
      body: body || "You have a new notification",
      icon: "/pwa-512.png",
      badge: "/pwa-512.png",
      tag: tag || `talco-${Date.now()}`,
      data: { url: url || "/", ...extraData },
    };

    let sent = 0;
    let failed = 0;
    const expiredEndpoints: string[] = [];

    // Send to all subscriptions in parallel
    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        const result = await sendPushToEndpoint(
          sub.endpoint, sub.p256dh_key, sub.auth_key,
          pushPayload, vapidPublicKey, vapidPrivateKey
        );
        if (result.success) {
          sent++;
        } else if (result.error === "subscription_expired") {
          expiredEndpoints.push(sub.endpoint);
          failed++;
        } else {
          failed++;
        }
        return result;
      })
    );

    // Deactivate expired subscriptions
    if (expiredEndpoints.length > 0) {
      await supabase
        .from("push_subscriptions")
        .update({ is_active: false })
        .in("endpoint", expiredEndpoints);
      console.log(`[WebPush] Deactivated ${expiredEndpoints.length} expired subscriptions`);
    }

    return new Response(
      JSON.stringify({ success: true, sent, failed, total: subscriptions.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[WebPush] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

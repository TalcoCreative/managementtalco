import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search, FileText, Filter, Lock } from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { CreateLetterDialog } from "@/components/letters/CreateLetterDialog";
import { LetterDetailDialog } from "@/components/letters/LetterDetailDialog";

const ENTITIES = [
  { code: "TCI", name: "Talco Creative Indonesia" },
  { code: "TS", name: "Talco Studio" },
  { code: "TW", name: "Talco World" },
];

const STATUSES = [
  { value: "draft", label: "Draft", color: "bg-muted text-muted-foreground" },
  { value: "ready_to_send", label: "Siap Dikirim", color: "bg-blue-500/20 text-blue-600" },
  { value: "sent", label: "Terkirim", color: "bg-green-500/20 text-green-600" },
  { value: "closed", label: "Closed", color: "bg-gray-500/20 text-gray-600" },
];

const ALLOWED_ROLES = ["project_manager", "hr", "super_admin", "finance", "sales"];

export default function Letters() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedLetter, setSelectedLetter] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: currentUser } = useQuery({
    queryKey: ["current-user-letters"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  const { data: userRoles } = useQuery({
    queryKey: ["user-roles-letters"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      
      return data?.map(r => r.role) || [];
    },
  });

  const hasAccess = userRoles?.some(role => ALLOWED_ROLES.includes(role));
  const isSuperAdmin = userRoles?.includes("super_admin");
  const canManage = userRoles?.some(role => 
    ["hr", "super_admin", "finance", "project_manager"].includes(role)
  );

  const { data: letters, isLoading, refetch } = useQuery({
    queryKey: ["letters", entityFilter, statusFilter, currentUser?.id, isSuperAdmin],
    queryFn: async () => {
      let query = supabase
        .from("letters")
        .select(`
          *,
          created_by_profile:profiles!letters_created_by_fkey(full_name),
          sent_by_profile:profiles!letters_sent_by_fkey(full_name),
          project:projects(title)
        `)
        .order("created_at", { ascending: false });

      if (entityFilter && entityFilter !== "all") {
        query = query.eq("entity_code", entityFilter);
      }
      if (statusFilter && statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Filter confidential letters - only creator and super_admin can see
      return data?.filter(letter => {
        if (!letter.is_confidential) return true;
        if (isSuperAdmin) return true;
        if (letter.created_by === currentUser?.id) return true;
        return false;
      });
    },
    enabled: hasAccess,
  });

  const filteredLetters = letters?.filter(letter => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      letter.letter_number.toLowerCase().includes(query) ||
      letter.recipient_name.toLowerCase().includes(query) ||
      letter.recipient_company?.toLowerCase().includes(query)
    );
  });

  const getStatusBadge = (status: string) => {
    const statusInfo = STATUSES.find(s => s.value === status);
    return (
      <Badge className={statusInfo?.color || ""}>
        {statusInfo?.label || status}
      </Badge>
    );
  };

  if (!hasAccess) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <Lock className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-2xl font-bold mb-2">Akses Terbatas</h2>
            <p className="text-muted-foreground">
              Anda tidak memiliki akses ke halaman Manajemen Surat.
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Manajemen Surat</h1>
            <p className="text-muted-foreground">
              Kelola surat dengan nomor otomatis terstruktur
            </p>
          </div>
          {canManage && (
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Buat Surat Baru
            </Button>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filter & Pencarian
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cari nomor surat atau penerima..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={entityFilter} onValueChange={setEntityFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Semua Entitas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Entitas</SelectItem>
                  {ENTITIES.map(entity => (
                    <SelectItem key={entity.code} value={entity.code}>
                      {entity.code} - {entity.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Semua Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  {STATUSES.map(status => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Daftar Surat ({filteredLetters?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Memuat data...
              </div>
            ) : filteredLetters?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Tidak ada surat ditemukan
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nomor Surat</TableHead>
                      <TableHead>Entitas</TableHead>
                      <TableHead>Penerima</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Pembuat</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLetters?.map((letter) => (
                      <TableRow
                        key={letter.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelectedLetter(letter)}
                      >
                        <TableCell className="font-mono text-sm font-medium">
                          <div className="flex items-center gap-2">
                            {letter.is_confidential && (
                              <Lock className="h-4 w-4 text-red-500" />
                            )}
                            {letter.letter_number}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{letter.entity_code}</Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{letter.recipient_name}</div>
                            {letter.recipient_company && (
                              <div className="text-sm text-muted-foreground">
                                {letter.recipient_company}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(letter.status)}</TableCell>
                        <TableCell>
                          {format(new Date(letter.created_at), "dd MMM yyyy", {
                            locale: idLocale,
                          })}
                        </TableCell>
                        <TableCell>
                          {letter.created_by_profile?.full_name || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <CreateLetterDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onSuccess={() => {
            refetch();
            setCreateDialogOpen(false);
          }}
        />

        {selectedLetter && (
          <LetterDetailDialog
            letter={selectedLetter}
            open={!!selectedLetter}
            onOpenChange={(open) => !open && setSelectedLetter(null)}
            onUpdate={() => {
              refetch();
            }}
            canManage={canManage || false}
          />
        )}
      </div>
    </AppLayout>
  );
}

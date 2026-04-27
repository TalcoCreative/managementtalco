ALTER TABLE public.commission_rules
ADD CONSTRAINT commission_rules_user_product_unique UNIQUE (user_id, product_id);
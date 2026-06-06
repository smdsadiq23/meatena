ALTER TABLE invoice_item ADD COLUMN IF NOT EXISTS pieces integer;
ALTER TABLE purchase_item ADD COLUMN IF NOT EXISTS pieces integer;

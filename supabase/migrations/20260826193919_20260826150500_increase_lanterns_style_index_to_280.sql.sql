/*
# Increase lanterns style_index limit from 130 to 280

1. Modified Tables
- `lanterns`: cập nhật CHECK constraint trên cột `style_index` từ 1-130 thành 1-280.

2. Security
- Không thay đổi RLS.
*/

ALTER TABLE public.lanterns DROP CONSTRAINT IF EXISTS lanterns_style_index_check;
ALTER TABLE public.lanterns ADD CONSTRAINT lanterns_style_index_check CHECK (style_index BETWEEN 1 AND 280);

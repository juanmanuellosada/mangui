-- Adjuntos de resúmenes de tarjeta — parte 1/2
-- El valor de enum 'resumen' DEBE agregarse en su propia migración:
-- PostgreSQL no permite usar un valor de enum recién agregado en la
-- misma transacción que lo crea (Supabase envuelve cada archivo en una
-- transacción). El DDL que usa el valor vive en 0029.
ALTER TYPE attachment_kind ADD VALUE IF NOT EXISTS 'resumen';

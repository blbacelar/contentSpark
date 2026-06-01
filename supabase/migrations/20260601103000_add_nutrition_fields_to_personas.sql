ALTER TABLE personas
  ADD COLUMN IF NOT EXISTS especialidade TEXT,
  ADD COLUMN IF NOT EXISTS pilares_conteudo TEXT[],
  ADD COLUMN IF NOT EXISTS paciente_perfil TEXT;

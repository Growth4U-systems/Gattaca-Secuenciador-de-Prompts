-- =============================================================================
-- GROWTH4U FINAL FIX - RUN IN SUPABASE SQL EDITOR
-- =============================================================================
-- Este SQL actualiza las políticas RLS para que todos los usuarios de Growth4U
-- puedan acceder a todos los datos de la agency Growth4U
-- =============================================================================

-- 1. Crear tabla agency_members para gestión multi-usuario
CREATE TABLE IF NOT EXISTS agency_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE NOT NULL,
    user_id UUID NOT NULL,
    role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(agency_id, user_id)
);

ALTER TABLE agency_members ENABLE ROW LEVEL SECURITY;

-- 2. Agregar todos los miembros de Growth4U
-- growth4u agency ID: 5cdbd871-8572-4084-b152-79f0eff3fc71

-- martin@growth4u.io (owner)
INSERT INTO agency_members (agency_id, user_id, role)
VALUES ('5cdbd871-8572-4084-b152-79f0eff3fc71', '027dd02c-29ba-4539-8222-2f3203c7eeff', 'owner')
ON CONFLICT (agency_id, user_id) DO UPDATE SET role = 'owner';

-- alfonso@growth4u.io (admin)
INSERT INTO agency_members (agency_id, user_id, role)
VALUES ('5cdbd871-8572-4084-b152-79f0eff3fc71', '4e7150c0-7601-43f6-9b61-dcd747e394e0', 'admin')
ON CONFLICT (agency_id, user_id) DO UPDATE SET role = 'admin';

-- philippe@growth4u.io (admin)
INSERT INTO agency_members (agency_id, user_id, role)
VALUES ('5cdbd871-8572-4084-b152-79f0eff3fc71', '3a0aef18-c485-4c32-a8f8-42882bbe3397', 'admin')
ON CONFLICT (agency_id, user_id) DO UPDATE SET role = 'admin';

-- alex@growth4u.io (member)
INSERT INTO agency_members (agency_id, user_id, role)
VALUES ('5cdbd871-8572-4084-b152-79f0eff3fc71', '2bef4e0d-43bd-445f-a1eb-bcaac5244e06', 'member')
ON CONFLICT (agency_id, user_id) DO UPDATE SET role = 'member';

-- =============================================================================
-- 3. ACTUALIZAR POLÍTICAS RLS
-- =============================================================================

-- Drop todas las políticas existentes
DROP POLICY IF EXISTS "Agency owner manages agency" ON agencies;
DROP POLICY IF EXISTS "Agency owner manages clients" ON clients;
DROP POLICY IF EXISTS "Agency owner manages documents" ON documents;
DROP POLICY IF EXISTS "Agency owner manages playbooks" ON playbooks;
DROP POLICY IF EXISTS "Agency owner manages executions" ON playbook_executions;
DROP POLICY IF EXISTS "Authenticated users access agencies" ON agencies;
DROP POLICY IF EXISTS "Authenticated users access clients" ON clients;
DROP POLICY IF EXISTS "Authenticated users access documents" ON documents;
DROP POLICY IF EXISTS "Authenticated users access playbooks" ON playbooks;
DROP POLICY IF EXISTS "Authenticated users access executions" ON playbook_executions;
DROP POLICY IF EXISTS "Agency members access agencies" ON agencies;
DROP POLICY IF EXISTS "Agency members access clients" ON clients;
DROP POLICY IF EXISTS "Agency members access documents" ON documents;
DROP POLICY IF EXISTS "Agency members access playbooks" ON playbooks;
DROP POLICY IF EXISTS "Agency members access executions" ON playbook_executions;
DROP POLICY IF EXISTS "Members access own memberships" ON agency_members;

-- Política para agency_members
CREATE POLICY "Members access own memberships"
    ON agency_members FOR ALL
    USING (user_id = auth.uid());

-- Agencies: Owner o miembro puede acceder
CREATE POLICY "Agency members access agencies"
    ON agencies FOR ALL
    USING (
        owner_id = auth.uid()
        OR id IN (SELECT agency_id FROM agency_members WHERE user_id = auth.uid())
    );

-- Clients: Miembros de la agency pueden acceder
CREATE POLICY "Agency members access clients"
    ON clients FOR ALL
    USING (
        agency_id IN (
            SELECT a.id FROM agencies a
            LEFT JOIN agency_members am ON am.agency_id = a.id
            WHERE a.owner_id = auth.uid() OR am.user_id = auth.uid()
        )
    );

-- Documents: A través de client -> agency membership
CREATE POLICY "Agency members access documents"
    ON documents FOR ALL
    USING (
        client_id IN (
            SELECT c.id FROM clients c
            JOIN agencies a ON a.id = c.agency_id
            LEFT JOIN agency_members am ON am.agency_id = a.id
            WHERE a.owner_id = auth.uid() OR am.user_id = auth.uid()
        )
    );

-- Playbooks: Miembros de la agency pueden acceder
CREATE POLICY "Agency members access playbooks"
    ON playbooks FOR ALL
    USING (
        agency_id IN (
            SELECT a.id FROM agencies a
            LEFT JOIN agency_members am ON am.agency_id = a.id
            WHERE a.owner_id = auth.uid() OR am.user_id = auth.uid()
        )
    );

-- Executions: A través de client -> agency membership
CREATE POLICY "Agency members access executions"
    ON playbook_executions FOR ALL
    USING (
        client_id IN (
            SELECT c.id FROM clients c
            JOIN agencies a ON a.id = c.agency_id
            LEFT JOIN agency_members am ON am.agency_id = a.id
            WHERE a.owner_id = auth.uid() OR am.user_id = auth.uid()
        )
    );

-- =============================================================================
-- 4. VERIFICACIÓN
-- =============================================================================
-- Después de ejecutar, verifica con:
-- SELECT * FROM agency_members;
-- SELECT am.user_id, u.email, am.role
-- FROM agency_members am
-- JOIN auth.users u ON u.id = am.user_id;

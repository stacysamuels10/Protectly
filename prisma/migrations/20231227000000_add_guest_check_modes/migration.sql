-- Add new values to GuestCheckMode enum
-- Using IF NOT EXISTS to handle cases where values might already exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'NO_GUESTS' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'GuestCheckMode')) THEN
        ALTER TYPE "GuestCheckMode" ADD VALUE 'NO_GUESTS';
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'ALLOW_ALL' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'GuestCheckMode')) THEN
        ALTER TYPE "GuestCheckMode" ADD VALUE 'ALLOW_ALL';
    END IF;
END
$$;


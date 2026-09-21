-- Comments on products and annotations on periods.
--
-- Identity is stored denormalised on every row rather than in a users table: the source of
-- truth will be Microsoft Entra, not us. `author_source` records whether a row was written
-- before SSO arrived, so honour-system rows stay distinguishable from verified ones instead of
-- silently looking verified once SSO lands.

DO $$ BEGIN
  CREATE TYPE author_source AS ENUM ('local', 'entra');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS product_comments (
  id            BIGSERIAL PRIMARY KEY,
  product_id    TEXT,
  barcode       TEXT,
  marketplace   TEXT,
  parent_id     BIGINT REFERENCES product_comments(id) ON DELETE CASCADE,
  body          TEXT NOT NULL CHECK (length(btrim(body)) > 0),
  author_id     TEXT NOT NULL,
  author_name   TEXT NOT NULL,
  author_source author_source NOT NULL DEFAULT 'local',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ,
  CONSTRAINT one_target CHECK (num_nonnulls(product_id, barcode) = 1)
);

-- "A reply cannot be replied to" needs to see another row, which CHECK cannot do.
CREATE OR REPLACE FUNCTION enforce_reply_depth() RETURNS trigger AS $$
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM product_comments WHERE id = NEW.parent_id AND parent_id IS NOT NULL) THEN
      RAISE EXCEPTION 'balasan hanya boleh satu tingkat';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS product_comments_reply_depth ON product_comments;
CREATE TRIGGER product_comments_reply_depth
  BEFORE INSERT OR UPDATE ON product_comments
  FOR EACH ROW EXECUTE FUNCTION enforce_reply_depth();

CREATE INDEX IF NOT EXISTS product_comments_by_product
  ON product_comments (product_id, created_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS product_comments_by_barcode
  ON product_comments (barcode, created_at) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS period_annotations (
  id            BIGSERIAL PRIMARY KEY,
  starts_on     DATE NOT NULL,
  ends_on       DATE NOT NULL,
  title         TEXT NOT NULL CHECK (length(btrim(title)) > 0),
  body          TEXT,
  brand         TEXT,
  marketplace   TEXT,
  author_id     TEXT NOT NULL,
  author_name   TEXT NOT NULL,
  author_source author_source NOT NULL DEFAULT 'local',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ,
  CONSTRAINT range_valid CHECK (ends_on >= starts_on)
);

-- The page always asks "which annotations touch this window", which is a range-overlap test.
CREATE INDEX IF NOT EXISTS period_annotations_range
  ON period_annotations USING gist (daterange(starts_on, ends_on, '[]'));

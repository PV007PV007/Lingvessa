-- IMP-P1-003: isolated synthetic bootstrap probe, not the P2 domain schema.
CREATE SCHEMA IF NOT EXISTS "p1_bootstrap";
CREATE TABLE "p1_bootstrap"."fixtures" (
    "id" UUID NOT NULL,
    "stable_code" VARCHAR(64) NOT NULL,
    "version_code" VARCHAR(32) NOT NULL,
    "language_code" VARCHAR(2) NOT NULL,
    "locale" VARCHAR(16) NOT NULL,
    "sample_text" TEXT NOT NULL,
    CONSTRAINT "fixtures_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "bootstrap_fixture_locale_check" CHECK (
      ("language_code" = 'en' AND "locale" = 'en-GB') OR
      ("language_code" = 'cs' AND "locale" = 'cs-CZ')
    )
);
CREATE UNIQUE INDEX "bootstrap_fixture_code_version_key"
  ON "p1_bootstrap"."fixtures"("stable_code", "version_code");

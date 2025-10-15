-- AlterTable
ALTER TABLE "users" ADD COLUMN     "image" TEXT;

-- Update existing users to have GRANTED permission
UPDATE "users" SET "permission" = 'GRANTED' WHERE "permission" = 'DENIED';

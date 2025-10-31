-- Supabase Storage RLS Policies for 'avatars' bucket
-- Run these in the Supabase SQL Editor

-- NOTE: Before creating these policies, make sure you've created the 'avatars' bucket
-- in the Supabase Dashboard under Storage.

-- 1. Allow public read access (anyone can view avatars)
-- This allows anyone to access avatar URLs generated with getPublicUrl()
CREATE POLICY "Public Avatar Access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- 2. Allow authenticated users to upload avatars
-- Users can only upload files that start with their auth UUID
CREATE POLICY "Authenticated users can upload avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND
  -- Ensure filename starts with their auth user ID (UUID followed by hyphen)
  name LIKE auth.uid()::text || '-%'
);

-- 3. Allow authenticated users to delete their own avatars
-- Users can only delete files that start with their auth UUID
CREATE POLICY "Users can delete own avatars"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  name LIKE auth.uid()::text || '-%'
);

-- 4. Allow authenticated users to update their own avatars
-- Users can only update files that start with their auth UUID
CREATE POLICY "Users can update own avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  name LIKE auth.uid()::text || '-%'
)
WITH CHECK (
  bucket_id = 'avatars' AND
  name LIKE auth.uid()::text || '-%'
);

-- ALTERNATIVE: If you want a simpler, less restrictive policy:
-- Uncomment the policies below and comment out policies 2-4 above

-- CREATE POLICY "Authenticated users can upload any avatar"
-- ON storage.objects FOR INSERT
-- TO authenticated
-- WITH CHECK (bucket_id = 'avatars');

-- CREATE POLICY "Authenticated users can delete any avatar"
-- ON storage.objects FOR DELETE
-- TO authenticated
-- USING (bucket_id = 'avatars');

-- CREATE POLICY "Authenticated users can update any avatar"
-- ON storage.objects FOR UPDATE
-- TO authenticated
-- USING (bucket_id = 'avatars')
-- WITH CHECK (bucket_id = 'avatars');


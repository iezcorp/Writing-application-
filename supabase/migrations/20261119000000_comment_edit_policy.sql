-- Allow authenticated users to edit only comments that they own.
drop policy if exists "Users can update their own comments" on public.comments;
create policy "Users can update their own comments"
on public.comments
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

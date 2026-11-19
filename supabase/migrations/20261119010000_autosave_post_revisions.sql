alter table public.posts
  add column if not exists revision_of uuid references public.posts(id) on delete set null;

create index if not exists posts_revision_idx on public.posts(revision_of);

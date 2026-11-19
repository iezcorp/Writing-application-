// Deploy with: supabase functions deploy delete-account
// Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY as Edge Function secrets.
// Never put the service-role key in script.js or any browser code.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response(JSON.stringify({error:"Method not allowed"}), {status:405,headers:{"Content-Type":"application/json"}});
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response(JSON.stringify({error:"Missing authorization"}), {status:401,headers:{"Content-Type":"application/json"}});
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey);
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const { data: { user }, error: userError } = await admin.auth.getUser(token);
  if (userError || !user) return new Response(JSON.stringify({error:"Not authorized"}), {status:401,headers:{"Content-Type":"application/json"}});
  // Remove all profile-picture objects owned by this user before deleting the auth user.
  const bucket = "profile-pictures";
  const { data: files } = await admin.storage.from(bucket).list(user.id, {limit:1000});
  if (files?.length) {
    const paths = files.filter(f => f.name).map(f => `${user.id}/${f.name}`);
    if (paths.length) {
      const { error: storageError } = await admin.storage.from(bucket).remove(paths);
      if (storageError) return new Response(JSON.stringify({error:`Could not remove profile pictures: ${storageError.message}`}), {status:500,headers:{"Content-Type":"application/json"}});
    }
  }
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) return new Response(JSON.stringify({error:deleteError.message}), {status:500,headers:{"Content-Type":"application/json"}});
  return new Response(JSON.stringify({success:true}), {status:200,headers:{"Content-Type":"application/json"}});
});

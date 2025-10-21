import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InviteRequest {
  email: string;
  fullName: string;
  role: 'admin' | 'guest';
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Autorizzazione mancante");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      throw new Error("Non autorizzato");
    }

    // Check if user is admin
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!roles || roles.role !== 'admin') {
      throw new Error("Solo gli amministratori possono registrare utenti");
    }

    const { email, fullName, role }: InviteRequest = await req.json();

    console.log(`Admin ${user.email} registering user ${email} with role ${role}`);

    // Create user with admin API - Supabase invia automaticamente l'email di conferma
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      email_confirm: false, // Richiede conferma via email
      user_metadata: {
        full_name: fullName,
      },
    });

    if (createError) {
      console.error("Error creating user:", createError);
      throw new Error(`Errore nella creazione utente: ${createError.message}`);
    }

    if (!newUser.user) {
      throw new Error("Utente non creato");
    }

    console.log(`User created: ${newUser.user.id} - Confirmation email sent by Supabase`);

    // Assign role
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({
        user_id: newUser.user.id,
        role: role,
        authorized_by: user.id,
      });

    if (roleError) {
      console.error("Error assigning role:", roleError);
      throw new Error("Errore nell'assegnazione del ruolo");
    }

    console.log(`Role ${role} assigned to user ${newUser.user.id}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Utente registrato e email inviata"
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in send-invite:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DeleteUserRequest {
  userId: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Verify admin authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Non autorizzato');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Non autorizzato');
    }

    // Check if user is admin
    const { data: roleData, error: roleError } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleError || roleData?.role !== 'admin') {
      throw new Error('Solo gli amministratori possono eliminare utenti');
    }

    const { userId }: DeleteUserRequest = await req.json();

    if (!userId) {
      throw new Error('ID utente mancante');
    }

    // Prevent admin from deleting themselves
    if (userId === user.id) {
      throw new Error('Non puoi eliminare il tuo stesso account');
    }

    // Delete user using admin API
    const { error: deleteError } = await supabaseClient.auth.admin.deleteUser(userId);

    if (deleteError) {
      throw deleteError;
    }

    console.log(`User ${userId} deleted successfully by admin ${user.id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Utente eliminato con successo'
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in delete-user function:", error);
    return new Response(
      JSON.stringify({ error: error.message || 'Errore nell\'eliminazione dell\'utente' }),
      {
        status: error.message.includes('Non autorizzato') || error.message.includes('amministratori') ? 403 : 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);

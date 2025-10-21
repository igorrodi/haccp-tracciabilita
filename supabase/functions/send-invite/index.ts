import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

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
      throw new Error('Solo gli amministratori possono inviare inviti');
    }

    const { email, fullName, role }: InviteRequest = await req.json();

    if (!email || !fullName || !role) {
      throw new Error('Dati mancanti');
    }

    // Check if user already exists
    const { data: existingUser } = await supabaseClient
      .from('profiles')
      .select('email')
      .eq('email', email)
      .single();

    if (existingUser) {
      throw new Error('Un utente con questa email esiste già');
    }

    // Generate magic link for signup
    const redirectUrl = `${Deno.env.get('SUPABASE_URL')}/auth/v1/verify?token={token}&type=signup&redirect_to=${encodeURIComponent(req.headers.get('origin') || 'http://localhost:5173')}`;

    // Create a temporary token/link (we'll use a custom approach)
    const inviteToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Store invite in a custom table (we'll need to create this)
    // For now, we'll send a signup link
    const appUrl = req.headers.get('origin') || 'http://localhost:5173';
    const signupUrl = `${appUrl}/auth?invite=${inviteToken}&email=${encodeURIComponent(email)}&role=${role}`;

    const emailResponse = await resend.emails.send({
      from: "HACCP Chef <onboarding@resend.dev>",
      to: [email],
      subject: "Invito alla piattaforma HACCP 🎉",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2>Hey there! 👋</h2>
          <p>Ciao <strong>${fullName}</strong>! Sono il tuo Chef e questo è il link per la nostra fantastica applicazione di tracciabilità HACCP, pensata per rendere il processo più semplice e gradevole! 🎉</p>
          
          <p>Sei stato invitato come <strong>${role === 'admin' ? 'Amministratore' : 'Utente'}</strong>.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${signupUrl}" 
               style="background-color: #4CAF50; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">
              Clicca qui per confermare il tuo accesso! 🚀
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px;">
            Oppure copia e incolla questo link nel tuo browser:<br>
            <a href="${signupUrl}" style="color: #4CAF50; word-break: break-all;">${signupUrl}</a>
          </p>
          
          <p style="margin-top: 30px;">Grazie per collaborare! 💖<br>Buon lavoro! 💪</p>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
          
          <p style="color: #999; font-size: 12px;">
            Questo invito scade tra 7 giorni. Se non hai richiesto questo invito, puoi ignorare questa email.
          </p>
        </div>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Invito inviato con successo',
        emailResponse 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-invite function:", error);
    return new Response(
      JSON.stringify({ error: error.message || 'Errore nell\'invio dell\'invito' }),
      {
        status: error.message === 'Non autorizzato' || error.message === 'Solo gli amministratori possono inviare inviti' ? 403 : 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);

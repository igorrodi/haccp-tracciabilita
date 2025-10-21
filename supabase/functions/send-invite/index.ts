import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@4.0.0";
import React from "https://esm.sh/react@18.3.1";
import { renderAsync } from "https://esm.sh/@react-email/components@0.0.22";
import { ConfirmationEmail } from "./_templates/confirmation-email.tsx";

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

    // Create user with admin API
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      email_confirm: false,
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

    console.log(`User created: ${newUser.user.id}`);

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
      // Continue even if role assignment fails - can be done manually
    }

    // Generate confirmation link
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'invite',
      email: email,
    });

    if (linkError || !linkData) {
      console.error("Error generating link:", linkError);
      throw new Error("Errore nella generazione del link di conferma");
    }

    console.log("Confirmation link generated");

    // Render email template
    const html = await renderAsync(
      React.createElement(ConfirmationEmail, {
        fullName: fullName,
        confirmationUrl: linkData.properties.action_link,
        role: role,
      })
    );

    // Send email
    const { error: emailError } = await resend.emails.send({
      from: "Sistema HACCP <onboarding@resend.dev>",
      to: [email],
      subject: "Conferma il tuo accesso al Sistema HACCP 🚀",
      html: html,
    });

    if (emailError) {
      console.error("Email error:", emailError);
      throw new Error(`Errore nell'invio email: ${emailError.message}`);
    }

    console.log(`Confirmation email sent to ${email}`);

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

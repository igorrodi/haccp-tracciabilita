import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from 'https://esm.sh/@react-email/components@0.0.22'
import * as React from 'https://esm.sh/react@18.3.1'

interface ConfirmationEmailProps {
  fullName: string;
  confirmationUrl: string;
  role: string;
}

export const ConfirmationEmail = ({
  fullName,
  confirmationUrl,
  role,
}: ConfirmationEmailProps) => (
  <Html>
    <Head />
    <Preview>Conferma il tuo accesso al Sistema HACCP</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Hey there! 👋</Heading>
        <Text style={text}>
          Ciao <strong>{fullName}</strong>! Sono il tuo Chef e questo è il link per la nostra fantastica applicazione di tracciabilità HACCP, pensata per rendere il processo più semplice e gradevole! 🎉
        </Text>
        <Text style={text}>
          Sei stato registrato con il ruolo di <strong>{role === 'admin' ? 'Amministratore' : 'Utente'}</strong>.
        </Text>
        <Link
          href={confirmationUrl}
          target="_blank"
          style={button}
        >
          Clicca qui per confermare il tuo accesso! 🚀
        </Link>
        <Text style={text}>
          Grazie per collaborare! 💖<br />
          Buon lavoro! 💪
        </Text>
        <Text style={footer}>
          Sistema HACCP - Gestione Tracciabilità Alimentare
        </Text>
      </Container>
    </Body>
  </Html>
)

export default ConfirmationEmail

const main = {
  backgroundColor: '#ffffff',
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
}

const container = {
  paddingLeft: '12px',
  paddingRight: '12px',
  margin: '0 auto',
  paddingTop: '40px',
  paddingBottom: '40px',
}

const h1 = {
  color: '#333',
  fontSize: '28px',
  fontWeight: 'bold',
  margin: '40px 0 20px',
  padding: '0',
}

const text = {
  color: '#333',
  fontSize: '16px',
  lineHeight: '26px',
  margin: '16px 0',
}

const button = {
  backgroundColor: '#007bff',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '16px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '16px 32px',
  margin: '24px 0',
}

const footer = {
  color: '#898989',
  fontSize: '14px',
  lineHeight: '22px',
  marginTop: '32px',
  borderTop: '1px solid #eee',
  paddingTop: '16px',
}

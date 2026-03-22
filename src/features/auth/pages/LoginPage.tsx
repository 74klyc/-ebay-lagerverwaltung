import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '../hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from '@/hooks/use-toast'

const loginSchema = z.object({
  email: z.string().email('Bitte geben Sie eine gültige E-Mail ein'),
  password: z.string().min(6, 'Passwort muss mindestens 6 Zeichen haben'),
})

type LoginForm = z.infer<typeof loginSchema>

export function LoginPage() {
  const navigate = useNavigate()
  const { signIn } = useAuth()
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true)
    const { error } = await signIn(data.email, data.password)
    setIsLoading(false)

    if (error) {
      toast({
        title: 'Anmeldung fehlgeschlagen',
        description: error.message || 'Bitte überprüfen Sie Ihre Zugangsdaten.',
        variant: 'destructive',
      })
    } else {
      toast({
        title: 'Willkommen zurück!',
        description: 'Sie wurden erfolgreich angemeldet.',
      })
      navigate('/')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4 dark:from-slate-900 dark:to-slate-800">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Anmelden</CardTitle>
          <CardDescription>
            Geben Sie Ihre Zugangsdaten ein, um auf Ihr Konto zuzugreifen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-Mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="ihre@email.de"
                {...register('email')}
              />
              {errors.email && (
                <p className="text-sm text-red-500">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Passwort</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                {...register('password')}
              />
              {errors.password && (
                <p className="text-sm text-red-500">{errors.password.message}</p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Anmeldung...' : 'Anmelden'}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            Noch kein Konto?{' '}
            <Link to="/register" className="text-primary hover:underline">
              Registrieren
            </Link>
          </div>
          <div className="mt-2 text-center text-sm">
            <Link to="/reset-password" className="text-muted-foreground hover:underline">
              Passwort vergessen?
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

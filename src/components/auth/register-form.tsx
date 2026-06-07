"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, MailCheck, Eye, EyeOff, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const registerSchema = z.object({
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  email: z.string().email("Ingresá un email válido"),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .regex(/[A-Z]/, "Debe incluir al menos una mayúscula")
    .regex(/[0-9]/, "Debe incluir al menos un número"),
});

type RegisterValues = z.infer<typeof registerSchema>;

function getAuthErrorMessage(code: string): string {
  switch (code) {
    case "user_already_exists":
    case "email_exists":
      return "Ya existe una cuenta con ese email. ¿Querés iniciar sesión?";
    case "weak_password":
      return "La contraseña es demasiado débil. Usá al menos 8 caracteres con mayúsculas y números.";
    case "over_email_send_rate_limit":
      return "Demasiados intentos. Esperá unos minutos y volvé a intentar.";
    default:
      return "Ocurrió un error al crear la cuenta. Intentá de nuevo.";
  }
}

export function RegisterForm() {
  const [emailSent, setEmailSent] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
  });

  async function handleGoogleSignIn() {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/inicio`,
      },
    });
    if (error) {
      toast.error("No se pudo iniciar sesión con Google, probá de nuevo.");
    }
  }

  async function onSubmit(values: RegisterValues) {
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: {
          full_name: values.name,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/inicio`,
      },
    });

    if (error) {
      toast.error(getAuthErrorMessage(error.code ?? ""));
      return;
    }

    setSubmittedEmail(values.email);
    setEmailSent(true);
  }

  if (emailSent) {
    return (
      <div className="space-y-6 text-center animate-scale-in">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center">
            <MailCheck className="h-8 w-8 text-primary" />
          </div>
        </div>
        <div className="space-y-2">
          <h2
            className="text-2xl tracking-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Revisá tu email
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Te enviamos un enlace de confirmación a{" "}
            <span className="font-semibold text-foreground">{submittedEmail}</span>
            . Hacé click en el enlace para activar tu cuenta.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          ¿No te llegó?{" "}
          <button
            type="button"
            className="text-primary hover:underline font-medium cursor-pointer"
            onClick={() => setEmailSent(false)}
          >
            Volvé a intentar
          </button>{" "}
          o revisá la carpeta de spam.
        </p>
        <Link
          href="/login"
          className="block text-sm text-primary font-semibold hover:underline"
        >
          Volver al inicio de sesión
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <div className="space-y-1.5">
        <h2
          className="text-2xl tracking-tight"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Crear cuenta gratis
        </h2>
        <p className="text-sm text-muted-foreground">
          Sin tarjeta de crédito. Empezá en segundos.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        {/* Name */}
        <div className="space-y-1.5">
          <Label htmlFor="name" className="text-sm font-medium">
            Nombre
          </Label>
          <Input
            id="name"
            type="text"
            placeholder="Tu nombre"
            autoComplete="given-name"
            aria-invalid={!!errors.name}
            className={cn(
              "h-10",
              errors.name && "border-destructive focus-visible:ring-destructive/20"
            )}
            {...register("name")}
          />
          {errors.name && (
            <p className="text-xs text-destructive" role="alert">
              {errors.name.message}
            </p>
          )}
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-sm font-medium">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="vos@ejemplo.com"
            autoComplete="email"
            aria-invalid={!!errors.email}
            className={cn(
              "h-10",
              errors.email && "border-destructive focus-visible:ring-destructive/20"
            )}
            {...register("email")}
          />
          {errors.email && (
            <p className="text-xs text-destructive" role="alert">
              {errors.email.message}
            </p>
          )}
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-sm font-medium">
            Contraseña
          </Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Mínimo 8 caracteres"
              autoComplete="new-password"
              aria-invalid={!!errors.password}
              className={cn(
                "h-10 pr-10",
                errors.password && "border-destructive focus-visible:ring-destructive/20"
              )}
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded cursor-pointer"
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          {errors.password ? (
            <p className="text-xs text-destructive" role="alert">
              {errors.password.message}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Al menos 8 caracteres, una mayúscula y un número.
            </p>
          )}
        </div>

        <Button
          type="submit"
          className="w-full h-10 font-semibold gap-2 press-effect"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              Crear cuenta
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-3 text-muted-foreground font-medium tracking-wider">
            o
          </span>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full h-10 gap-2.5 font-medium press-effect"
        onClick={handleGoogleSignIn}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
        Continuar con Google
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        ¿Ya tenés cuenta?{" "}
        <Link
          href="/login"
          className="text-primary font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        >
          Iniciar sesión
        </Link>
      </p>
    </div>
  );
}

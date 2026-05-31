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

  async function onSubmit(values: RegisterValues) {
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: {
          full_name: values.name,
        },
        emailRedirectTo: `${window.location.origin}/app/dashboard`,
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

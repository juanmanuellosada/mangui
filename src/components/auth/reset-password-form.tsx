"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const schema = z
  .object({
    password: z
      .string()
      .min(8, "La contraseña debe tener al menos 8 caracteres")
      .regex(/[A-Z]/, "Debe incluir al menos una mayúscula")
      .regex(/[0-9]/, "Debe incluir al menos un número"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Las contraseñas no coinciden",
    path: ["confirm"],
  });

type Values = z.infer<typeof schema>;

export function ResetPasswordForm() {
  const router = useRouter();
  const [done, setDone] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  async function onSubmit(values: Values) {
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      password: values.password,
    });

    if (error) {
      toast.error("No se pudo actualizar la contraseña. El enlace puede haber expirado.");
      return;
    }

    setDone(true);
    toast.success("Contraseña actualizada correctamente.");
    setTimeout(() => router.push("/inicio"), 1500);
  }

  if (done) {
    return (
      <div className="space-y-5 text-center animate-scale-in">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center">
            <CheckCircle className="h-8 w-8 text-primary" />
          </div>
        </div>
        <div className="space-y-1.5">
          <h2
            className="text-2xl tracking-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Listo
          </h2>
          <p className="text-sm text-muted-foreground">
            Tu contraseña fue actualizada. Redirigiendo al panel…
          </p>
        </div>
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
          Nueva contraseña
        </h2>
        <p className="text-sm text-muted-foreground">
          Elegí una contraseña segura para tu cuenta.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        {/* New password */}
        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-sm font-medium">
            Nueva contraseña
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
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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

        {/* Confirm password */}
        <div className="space-y-1.5">
          <Label htmlFor="confirm" className="text-sm font-medium">
            Confirmá la contraseña
          </Label>
          <div className="relative">
            <Input
              id="confirm"
              type={showConfirm ? "text" : "password"}
              placeholder="Repetí tu contraseña"
              autoComplete="new-password"
              aria-invalid={!!errors.confirm}
              className={cn(
                "h-10 pr-10",
                errors.confirm && "border-destructive focus-visible:ring-destructive/20"
              )}
              {...register("confirm")}
            />
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded cursor-pointer"
              aria-label={showConfirm ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.confirm && (
            <p className="text-xs text-destructive" role="alert">
              {errors.confirm.message}
            </p>
          )}
        </div>

        <Button
          type="submit"
          className="w-full h-10 font-semibold press-effect"
          disabled={isSubmitting}
        >
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Guardar contraseña
        </Button>
      </form>
    </div>
  );
}

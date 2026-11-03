import { z } from "zod";

const optionalNote = z.string().max(1000, "La nota no puede superar 1.000 caracteres");

export const householdNameSchema = z
  .string()
  .trim()
  .min(1, "Escribe un nombre para el hogar")
  .max(80, "El nombre del hogar puede tener hasta 80 caracteres");

export const productSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Escribe el nombre del producto")
    .max(100, "El nombre puede tener hasta 100 caracteres"),
  category: z.string().trim().max(60).nullable(),
});

export const taskSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Escribe el nombre de la actividad")
    .max(100, "El nombre puede tener hasta 100 caracteres"),
  frequencyDays: z.number().int().min(1).max(3650).nullable(),
});

export const purchaseSchema = z.object({
  purchasedAt: z.iso.date("Elige una fecha válida"),
  quantity: z.number().positive("La cantidad debe ser mayor que cero").nullable(),
  unit: z.string().trim().max(30),
  notes: optionalNote.nullable(),
});

export const readingSchema = z.object({
  readAt: z.iso.datetime(),
  valueKwh: z.number().finite().min(0, "La lectura acumulada no puede ser negativa"),
  notes: optionalNote.nullable(),
});

export const completionSchema = z.object({
  completedAt: z.iso.date("Elige una fecha válida"),
  frequencyDays: z.number().int().min(1).max(3650).nullable(),
  notes: optionalNote.nullable(),
});

export const billSchema = z
  .object({
    issuedAt: z.iso.date(),
    periodStart: z.iso.date(),
    periodEnd: z.iso.date(),
    initialReadingKwh: z.number().finite().min(0).nullable(),
    finalReadingKwh: z.number().finite().min(0).nullable(),
    billedKwh: z.number().finite().min(0).nullable(),
    amountClp: z.number().int().min(0).nullable(),
    otherChargesClp: z.number().int().min(0).nullable(),
    notes: optionalNote.nullable(),
  })
  .refine((bill) => bill.periodEnd >= bill.periodStart, {
    message: "El fin del período debe ser igual o posterior al inicio",
    path: ["periodEnd"],
  });

export function firstIssueMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? "Revisa los datos e inténtalo de nuevo.";
}

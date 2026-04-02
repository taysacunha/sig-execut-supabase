import { z } from "zod";

const weekdayShiftAvailabilitySchema = z.record(
  z.string(), 
  z.array(z.enum(["morning", "afternoon"]))
);

export const brokerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Nome deve ter pelo menos 3 caracteres")
    .max(100, "Nome deve ter no máximo 100 caracteres"),
  creci: z
    .string()
    .trim()
    .min(1, "CRECI é obrigatório")
    .regex(/^\d+-F$/, "CRECI deve conter apenas números seguidos de -F")
    .max(21, "CRECI inválido"),
  weekday_shift_availability: weekdayShiftAvailabilitySchema,
});

export type BrokerFormData = z.infer<typeof brokerSchema>;

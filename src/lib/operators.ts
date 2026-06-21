import { operatorEnum } from "@/db/schema/enums";

export type Operator = (typeof operatorEnum.enumValues)[number];

export const OPERATOR_LABEL: Record<Operator, string> = {
  megabus: "Megabus",
  national_express: "National Express",
  flixbus: "FlixBus",
  stagecoach: "Stagecoach",
};

export const OPERATOR_VALUES = operatorEnum.enumValues;

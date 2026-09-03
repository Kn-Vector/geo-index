export function classificationLabel(value: string): string {
  switch (value) {
    case "un-member":
      return "UN member";
    case "un-observer":
      return "UN observer";
    case "associated-state":
      return "Associated state";
    case "dependency":
      return "Dependency";
    case "sar":
      return "Special administrative region";
    case "territory":
      return "Territory";
    case "statistical-area":
      return "Statistical area";
    case "special-status":
      return "Special status";
    default:
      return value;
  }
}

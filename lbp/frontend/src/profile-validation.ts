const messages = {
  en: { required: "Complete the highlighted required fields.", invalid: "Check the highlighted fields.", adult: "Enter a valid date of birth. You must be at least 18.", range: "Enter a value within the allowed range.", measurements: "Enter height from 80 to 250 cm and weight from 25 to 350 kg." },
  ru: { required: "Заполните выделенные обязательные поля.", invalid: "Проверьте выделенные поля.", adult: "Укажите корректную дату рождения. Вам должно быть не менее 18 лет.", range: "Укажите значение в допустимом диапазоне.", measurements: "Укажите рост от 80 до 250 см и вес от 25 до 350 кг." },
  es: { required: "Completa los campos obligatorios resaltados.", invalid: "Revisa los campos resaltados.", adult: "Introduce una fecha de nacimiento válida. Debes tener al menos 18 años.", range: "Introduce un valor dentro del rango permitido.", measurements: "Indica una altura de 80 a 250 cm y un peso de 25 a 350 kg." },
  pt: { required: "Preencha os campos obrigatórios destacados.", invalid: "Verifique os campos destacados.", adult: "Introduza uma data de nascimento válida. Deve ter pelo menos 18 anos.", range: "Introduza um valor dentro do intervalo permitido.", measurements: "Indique uma altura de 80 a 250 cm e um peso de 25 a 350 kg." },
  fr: { required: "Remplissez les champs obligatoires surlignés.", invalid: "Vérifiez les champs surlignés.", adult: "Saisissez une date de naissance valide. Vous devez avoir au moins 18 ans.", range: "Saisissez une valeur dans la plage autorisée.", measurements: "Indiquez une taille de 80 à 250 cm et un poids de 25 à 350 kg." },
  de: { required: "Füllen Sie die hervorgehobenen Pflichtfelder aus.", invalid: "Prüfen Sie die hervorgehobenen Felder.", adult: "Geben Sie ein gültiges Geburtsdatum ein. Sie müssen mindestens 18 Jahre alt sein.", range: "Geben Sie einen Wert im zulässigen Bereich ein.", measurements: "Geben Sie eine Größe von 80 bis 250 cm und ein Gewicht von 25 bis 350 kg ein." },
  it: { required: "Compila i campi obbligatori evidenziati.", invalid: "Controlla i campi evidenziati.", adult: "Inserisci una data di nascita valida. Devi avere almeno 18 anni.", range: "Inserisci un valore nell'intervallo consentito.", measurements: "Indica un'altezza da 80 a 250 cm e un peso da 25 a 350 kg." },
  pl: { required: "Uzupełnij zaznaczone wymagane pola.", invalid: "Sprawdź zaznaczone pola.", adult: "Podaj prawidłową datę urodzenia. Musisz mieć co najmniej 18 lat.", range: "Podaj wartość w dozwolonym zakresie.", measurements: "Podaj wzrost od 80 do 250 cm i wagę od 25 do 350 kg." },
};

export type ProfileValidationLocale = keyof typeof messages;

const markupMessages: Record<ProfileValidationLocale, string> = {
  en: "Remove < and > from the highlighted fields. HTML markup is not allowed.",
  ru: "Удалите < и > из выделенных полей. HTML-разметка не разрешена.",
  es: "Elimina < y > de los campos resaltados. No se permite código HTML.",
  pt: "Remova < e > dos campos destacados. Não é permitido código HTML.",
  fr: "Retirez < et > des champs surlignés. Le code HTML n’est pas autorisé.",
  de: "Entfernen Sie < und > aus den markierten Feldern. HTML ist nicht erlaubt.",
  it: "Rimuovi < e > dai campi evidenziati. Il codice HTML non è consentito.",
  pl: "Usuń < i > z zaznaczonych pól. Kod HTML jest niedozwolony.",
};

export function profileServerValidation(locale: ProfileValidationLocale, detail: unknown): { fields: string[]; message: string } {
  const errors = Array.isArray(detail) ? detail : [];
  const fields = [...new Set(errors.flatMap((item) => {
    if (!item || typeof item !== "object" || !Array.isArray(item.loc)) return [];
    const field = item.loc.find((value: unknown) => typeof value === "string" && value !== "body");
    return typeof field === "string" && /^[a-zA-Z][a-zA-Z0-9]*$/.test(field) ? [field] : [];
  }))];
  const hasMarkup = errors.some((item) => /HTML markup/i.test(String(item?.msg ?? ""))) || /HTML markup/i.test(typeof detail === "string" ? detail : "");
  return { fields, message: hasMarkup ? markupMessages[locale] : messages[locale].invalid };
}

const citySelectionMessages: Record<ProfileValidationLocale, string> = {
  en: "Select a city from the list.",
  ru: "Выберите город из списка.",
  es: "Selecciona una ciudad de la lista.",
  pt: "Selecione uma cidade da lista.",
  fr: "Sélectionnez une ville dans la liste.",
  de: "Wählen Sie eine Stadt aus der Liste aus.",
  it: "Seleziona una città dall’elenco.",
  pl: "Wybierz miasto z listy.",
};
type ProfileLocation = { country: string; city: string; cityPlaceId?: string };
export function profileCitySelectionValid(location: ProfileLocation, original: ProfileLocation): boolean {
  if (!location.city.trim() || !location.country.trim()) return false;
  if (location.cityPlaceId?.trim()) return true;
  return location.city.trim() === original.city.trim()
    && location.country.trim().toUpperCase() === original.country.trim().toUpperCase();
}
export function profileValidationMessage(locale: ProfileValidationLocale, reason: keyof typeof messages.en | "citySelection"): string {
  if (reason === "citySelection") return citySelectionMessages[locale];
  return messages[locale][reason];
}

export function profileConstraintMessage(
  locale: keyof typeof messages,
  name: string,
  validity: Pick<ValidityState, "valueMissing" | "rangeOverflow" | "rangeUnderflow">,
): string {
  if (validity.valueMissing) return profileValidationMessage(locale, "required");
  if (name === "dateOfBirth") return profileValidationMessage(locale, "adult");
  if (validity.rangeOverflow || validity.rangeUnderflow) return profileValidationMessage(locale, "range");
  return profileValidationMessage(locale, "invalid");
}

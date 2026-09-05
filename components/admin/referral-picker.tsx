"use client";

import { useEffect, useMemo, useState } from "react";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";

export type ReferralOption = {
  key: string;
  label: string;
  phone: string;
};

const ADD_NEW_VALUE = "__add_new__";

interface ReferralPickerProps {
  nameValue: string;
  phoneValue: string;
  options: ReferralOption[];
  onNameChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  inputPlaceholder?: string;
  phonePlaceholder?: string;
  isRequired?: boolean;
  isInvalid?: boolean;
  errorMessage?: string;
  phoneErrorMessage?: string;
  className?: string;
}

export function ReferralPicker({
  nameValue,
  phoneValue,
  options,
  onNameChange,
  onPhoneChange,
  label = "Referral User Name",
  placeholder = "Select referrer",
  inputPlaceholder = "Enter referral user name",
  phonePlaceholder = "Enter referral phone number",
  isRequired = false,
  isInvalid = false,
  errorMessage,
  phoneErrorMessage,
  className,
}: ReferralPickerProps) {
  const optionKeys = useMemo(
    () => new Set(options.map((option) => option.key)),
    [options],
  );
  const [customValue, setCustomValue] = useState("");
  const [isCustomMode, setIsCustomMode] = useState(false);

  const selectedKey = isCustomMode
    ? ADD_NEW_VALUE
    : nameValue
      ? optionKeys.has(`${nameValue}||${phoneValue}`)
        ? `${nameValue}||${phoneValue}`
        : ADD_NEW_VALUE
      : "";

  useEffect(() => {
    if (!nameValue) {
      setCustomValue("");
      return;
    }

    if (optionKeys.has(`${nameValue}||${phoneValue}`)) {
      setCustomValue("");
      return;
    }

    setCustomValue(nameValue);
  }, [nameValue, optionKeys, phoneValue]);

  useEffect(() => {
    if (!isCustomMode) {
      return;
    }

    setCustomValue(nameValue && !optionKeys.has(`${nameValue}||${phoneValue}`) ? nameValue : "");
  }, [isCustomMode, nameValue, optionKeys, phoneValue]);

  return (
    <div className={className}>
      <Select
        label={label}
        placeholder={placeholder}
        selectedKeys={selectedKey ? new Set([selectedKey]) : new Set<string>()}
        onSelectionChange={(keys) => {
          const next = Array.from(keys)[0] as string | undefined;
          if (!next) {
            setIsCustomMode(false);
            setCustomValue("");
            onNameChange("");
            onPhoneChange("");
            return;
          }

          if (next === ADD_NEW_VALUE) {
            setIsCustomMode(true);
            onNameChange("");
            onPhoneChange("");
            return;
          }

          setIsCustomMode(false);
          setCustomValue("");
          const selected = options.find((option) => option.key === next);
          onNameChange(selected?.label ?? "");
          onPhoneChange(selected?.phone ?? "");
        }}
        isRequired={isRequired}
        isInvalid={isInvalid}
        errorMessage={errorMessage}
        variant="bordered"
      >
        <SelectItem key={ADD_NEW_VALUE}>➕ Add new referrer</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.key}>{option.label}</SelectItem>
        ))}
      </Select>

      {selectedKey === ADD_NEW_VALUE && (
        <Input
          className="mt-3"
          label=""
          placeholder={inputPlaceholder}
          value={customValue}
          autoFocus
          onChange={(event) => {
            const next = event.target.value;
            setCustomValue(next);
            setIsCustomMode(true);
            onNameChange(next);
          }}
          variant="bordered"
          isRequired={isRequired}
        />
      )}

      {isCustomMode && (
        <Input
          className="mt-3"
          label=""
          placeholder={phonePlaceholder}
          value={phoneValue}
          onChange={(event) => onPhoneChange(event.target.value)}
          variant="bordered"
          isRequired={isRequired}
          isInvalid={Boolean(phoneErrorMessage)}
          errorMessage={phoneErrorMessage}
        />
      )}
    </div>
  );
}

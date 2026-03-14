import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MinusIcon, PlusIcon, Settings2Icon } from "lucide-react";
import { useStore } from "zustand";
import { fontFamilies, setSettings, settingsStore } from "../lib/stores";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getByPath } from "@/lib/utils";

export default function SettingsModal() {
  const settings = useStore(settingsStore);

  const increase = (path: string, by: number, decimals = 2) => {
    let value = Math.max(0, getByPath<number>(settings, path) + by);
    value = Number(value.toFixed(decimals));

    setSettings(path as never, value as never);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" className="rounded-full" size="icon-lg">
          <Settings2Icon />
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md!">
        <DialogHeader>
          <DialogTitle>Reader Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          <Field orientation="horizontal">
            <FieldLabel>Font Family</FieldLabel>
            <Select
              value={settings.styles.fontFamily}
              onValueChange={(value) => setSettings("styles.fontFamily", value)}
            >
              <SelectTrigger className="w-full max-w-40">
                <SelectValue placeholder="Select font" />
              </SelectTrigger>

              <SelectContent>
                {fontFamilies.map((fontFamily) => (
                  <SelectItem key={fontFamily.value} value={fontFamily.value}>
                    {fontFamily.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field orientation="horizontal">
            <FieldLabel>Font Size</FieldLabel>
            <InputGroup className="w-full max-w-40">
              <InputGroupInput
                value={String(settings.styles.fontSize)}
                onChange={(e) =>
                  setSettings("styles.fontSize", Number(e.target.value || "1"))
                }
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  onClick={() => increase("styles.fontSize", -1)}
                >
                  <MinusIcon />
                </InputGroupButton>
                <InputGroupButton
                  onClick={() => increase("styles.fontSize", 1)}
                >
                  <PlusIcon />
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </Field>

          <Field orientation="horizontal">
            <FieldLabel>Text Spacing</FieldLabel>
            <InputGroup className="w-full max-w-40">
              <InputGroupInput
                value={String(settings.styles.spacing)}
                onChange={(e) =>
                  setSettings("styles.spacing", Number(e.target.value || "1"))
                }
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  onClick={() => increase("styles.spacing", -0.1)}
                >
                  <MinusIcon />
                </InputGroupButton>
                <InputGroupButton
                  onClick={() => increase("styles.spacing", 0.1)}
                >
                  <PlusIcon />
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </Field>
        </div>
      </DialogContent>
    </Dialog>
  );
}

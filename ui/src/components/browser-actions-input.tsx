import React from "react";
import type { Action } from "backend/schema";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Button } from "./ui/button";
import {
  ClockIcon,
  PlusIcon,
  SquareDashedMousePointerIcon,
  TrashIcon,
} from "lucide-react";
import { Checkbox } from "./ui/checkbox";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "./ui/input-group";

export type BrowserAction = Action & {
  enabled: boolean;
};

type Props = Omit<React.ComponentProps<"div">, "onChange"> & {
  actions: BrowserAction[];
  onChange: React.Dispatch<React.SetStateAction<BrowserAction[]>>;
  setSelectFn: (type: string | null, fn?: (el: any) => void) => void;
};

export default function BrowserActionsInput({
  actions,
  onChange,
  setSelectFn,
  ...props
}: Props) {
  const onAdd = () =>
    onChange((prev) => [
      ...prev,
      { type: "", enabled: true, data: {} } as never,
    ]);

  const onRemove = (idx: number) =>
    onChange((prev) => prev.filter((_, i) => i !== idx));

  const onValueChange = (idx: number, values: Partial<Action>) => {
    onChange((prev) => {
      const newActions = [...prev];
      newActions[idx] = {
        ...newActions[idx],
        ...values,
      } as never;
      return newActions;
    });
  };

  return (
    <div {...props}>
      <div className="space-y-2">
        {actions.map((action, idx) => (
          <div key={idx}>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={action.enabled}
                onCheckedChange={(checked) =>
                  onValueChange(idx, { enabled: !!checked } as never)
                }
              />

              <Select
                value={action.type}
                onValueChange={(type) => onValueChange(idx, { type } as never)}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Action Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="click">Click</SelectItem>
                  <SelectItem value="input">Input</SelectItem>
                  <SelectItem value="scroll">Scroll</SelectItem>
                  <SelectItem value="Wait">Wait</SelectItem>
                </SelectContent>
              </Select>

              <Button variant="outline" onClick={() => onRemove(idx)}>
                <TrashIcon />
              </Button>
            </div>

            {action.type === "click" && (
              <div className="ml-6 mt-2 space-y-2">
                <InputGroup>
                  <InputGroupInput
                    className="flex-1"
                    placeholder="Selector"
                    value={action.data?.selector || ""}
                    onChange={(e) =>
                      onValueChange(idx, {
                        data: { ...action.data, selector: e.target.value },
                      })
                    }
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      onClick={() => {
                        setSelectFn("click", (el) => {
                          onValueChange(idx, {
                            data: { ...action.data, selector: el.selector },
                          });
                          setSelectFn(null);
                        });
                      }}
                    >
                      <SquareDashedMousePointerIcon />
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>

                <InputGroup>
                  <InputGroupInput
                    className="flex-1"
                    placeholder="Wait for ms (optional)"
                    value={action.data?.waitFor || ""}
                    onChange={(e) =>
                      onValueChange(idx, {
                        data: {
                          ...action.data,
                          waitFor: Number(e.target.value) || 0,
                        },
                      })
                    }
                  />
                  <InputGroupAddon align="inline-end">
                    <ClockIcon />
                  </InputGroupAddon>
                </InputGroup>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 mt-2">
        <Button variant="outline" onClick={onAdd}>
          <PlusIcon /> Add
        </Button>
      </div>
    </div>
  );
}

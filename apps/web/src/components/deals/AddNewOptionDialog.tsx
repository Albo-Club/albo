import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AddNewOptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  onAdd: (value: string) => void;
}

export function AddNewOptionDialog({
  open,
  onOpenChange,
  title,
  onAdd,
}: AddNewOptionDialogProps) {
  const [value, setValue] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onAdd(value.trim());
      setValue("");
      onOpenChange(false);
    }
  };

  const handleCancel = () => {
    setValue("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="new-option" className="sr-only">
              {title}
            </Label>
            <Input
              id="new-option"
              placeholder={`Entrez un nouveau ${title.toLowerCase().replace("nouveau ", "")}`}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" size="sm" onClick={handleCancel}>
              Annuler
            </Button>
            <Button type="submit" size="sm" disabled={!value.trim()}>
              Ajouter
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

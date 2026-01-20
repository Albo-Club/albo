/**
 * Payment Form Example
 * Demonstrates the shadcn/ui neutral theme with all form components
 * Uses: Input, Select, Textarea, Button, Card, Checkbox, Label
 */

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CreditCard } from "lucide-react";

export function PaymentFormExample() {
  const [sameAddress, setSameAddress] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsSubmitting(false);
    console.log("Form submitted");
  };

  // Generate month options
  const months = Array.from({ length: 12 }, (_, i) => {
    const month = (i + 1).toString().padStart(2, "0");
    return { value: month, label: month };
  });

  // Generate year options (current year + 10 years)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 11 }, (_, i) => {
    const year = (currentYear + i).toString();
    return { value: year, label: year };
  });

  return (
    <Card className="w-full max-w-lg shadow-medium">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-xl">Informations de paiement</CardTitle>
        </div>
        <CardDescription className="text-sm text-muted-foreground">
          Entrez vos informations de carte bancaire pour finaliser votre commande.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Card holder name */}
          <div className="space-y-2">
            <Label htmlFor="cardName" className="text-sm font-medium">
              Nom sur la carte
            </Label>
            <Input
              id="cardName"
              type="text"
              placeholder="Jean Dupont"
              required
              className="h-10"
            />
          </div>

          {/* Card number */}
          <div className="space-y-2">
            <Label htmlFor="cardNumber" className="text-sm font-medium">
              Numéro de carte
            </Label>
            <Input
              id="cardNumber"
              type="text"
              placeholder="1234 5678 9012 3456"
              required
              maxLength={19}
              className="h-10 font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Entrez les 16 chiffres de votre carte
            </p>
          </div>

          {/* CVV, Month, Year row */}
          <div className="grid grid-cols-3 gap-4">
            {/* CVV */}
            <div className="space-y-2">
              <Label htmlFor="cvv" className="text-sm font-medium">
                CVV
              </Label>
              <Input
                id="cvv"
                type="text"
                placeholder="123"
                required
                maxLength={4}
                className="h-10 font-mono"
              />
            </div>

            {/* Month */}
            <div className="space-y-2">
              <Label htmlFor="month" className="text-sm font-medium">
                Mois
              </Label>
              <Select required>
                <SelectTrigger id="month" className="h-10">
                  <SelectValue placeholder="MM" />
                </SelectTrigger>
                <SelectContent>
                  {months.map((month) => (
                    <SelectItem key={month.value} value={month.value}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Year */}
            <div className="space-y-2">
              <Label htmlFor="year" className="text-sm font-medium">
                Année
              </Label>
              <Select required>
                <SelectTrigger id="year" className="h-10">
                  <SelectValue placeholder="AAAA" />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year.value} value={year.value}>
                      {year.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Same address checkbox */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="sameAddress"
              checked={sameAddress}
              onCheckedChange={(checked) => setSameAddress(checked as boolean)}
            />
            <Label
              htmlFor="sameAddress"
              className="text-sm font-normal cursor-pointer"
            >
              Même adresse de facturation que l'adresse de livraison
            </Label>
          </div>

          {/* Comments textarea */}
          <div className="space-y-2">
            <Label htmlFor="comments" className="text-sm font-medium">
              Commentaires
            </Label>
            <Textarea
              id="comments"
              placeholder="Instructions spéciales pour votre commande..."
              className="min-h-[100px] resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Optionnel - Maximum 500 caractères
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 shadow-soft hover:shadow-medium transition-shadow"
            >
              {isSubmitting ? "Traitement..." : "Soumettre le paiement"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1"
            >
              Annuler
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default PaymentFormExample;

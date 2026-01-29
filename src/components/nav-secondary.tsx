import { useState } from "react";
import { type LucideIcon } from "lucide-react";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { FeedbackModal } from "@/components/FeedbackModal";

interface NavSecondaryItem {
  title: string;
  url: string;
  icon: LucideIcon;
}

interface NavSecondaryProps extends React.ComponentPropsWithoutRef<typeof SidebarGroup> {
  items: NavSecondaryItem[];
}

export function NavSecondary({ items, ...props }: NavSecondaryProps) {
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const handleItemClick = (item: NavSecondaryItem) => {
    if (item.title === "Feedback") {
      setFeedbackOpen(true);
    }
  };

  return (
    <>
      <SidebarGroup {...props}>
        <SidebarGroupContent>
          <SidebarMenu>
            {items.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton 
                  size="sm" 
                  tooltip={item.title}
                  onClick={() => handleItemClick(item)}
                  className="cursor-pointer"
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
      
      <FeedbackModal open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </>
  );
}

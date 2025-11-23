"use client";

import React, { useState } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { withAuth } from "@/shared/components/route-protection";

function CourseDashboardLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <SidebarProvider open={open} onOpenChange={setOpen} defaultOpen={false}>
      {children}
    </SidebarProvider>
  );
}

export default withAuth(CourseDashboardLayoutContent);

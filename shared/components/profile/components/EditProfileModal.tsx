"use client";

import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { X, Save } from "lucide-react";
import { toast } from "react-hot-toast";

interface EditProfileModalProps {
  open: boolean;
  onClose: () => void;
  user: {
    id: string;
    name: string;
    role: string;
    image: string | null;
  };
}

export default function EditProfileModal({
  open,
  onClose,
  user,
}: EditProfileModalProps) {
  const [image, setImage] = useState(user.image);
  const [file, setFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const displayName = user.name || "Loading...";
  const initial = displayName.charAt(0).toUpperCase();

  // Format role display
  const formatRole = (role: string) => {
    switch (role) {
      case "ADMIN":
        return "Administrator";
      case "ACADEMIC_HEAD":
        return "Academic Head";
      case "FACULTY":
        return "Faculty";
      default:
        return role.replace(/_/g, " ");
    }
  };

  // Image select handler
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (!selected.type.startsWith("image/")) {
      toast.error("Only image files are allowed!");
      return;
    }
    if (selected.size > 2 * 1024 * 1024) {
      toast.error("File size exceeds 2MB limit.");
      return;
    }

    setFile(selected);
    setImage(URL.createObjectURL(selected));
  };

  // Delete image (from both file system and database)
  const handleRemoveImage = async () => {
    if (!image) return;

    setIsRemoving(true);
    try {
      // Delete from uploads folder
      const res = await fetch("/api/upload", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: image }),
      });
      if (!res.ok) throw new Error("Failed to delete image file.");

      // Update user record to remove image
      const update = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: null }),
      });
      if (!update.ok) throw new Error("Failed to update profile.");

      setImage("");
      setFile(null);
      toast.success(
        "Profile image removed successfully! Refresh to see changes."
      );
    } catch (error) {
      console.error("Remove error:", error);
      toast.error("Failed to remove image.");
    } finally {
      setIsRemoving(false);
    }
  };

  // Save uploaded image and update profile
  const handleSave = async () => {
    if (!file) {
      toast.error("Please select an image before saving.");
      return;
    }

    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("userId", user.id);

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) throw new Error("Failed to upload image.");
      const { imageUrl } = await uploadRes.json();

      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageUrl }),
      });

      if (!res.ok) throw new Error("Failed to update profile.");

      toast.success("Profile updated successfully! Refresh to see changes.");
      setFile(null);
      onClose();
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Failed to save profile changes.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl text-center">
        <DialogHeader>
          <DialogTitle className="flex justify-center text-2xl font-semibold text-[#124A69]">
            Edit Profile Picture
          </DialogTitle>
        </DialogHeader>

        <div className="relative w-55 h-55 group mx-auto mb-4">
          <Avatar className="w-55 h-55 border-4 border-gray-200">
            <AvatarImage
              src={image || user.image || undefined}
              className="object-cover"
            />
            <AvatarFallback className="text-xl">{initial}</AvatarFallback>
          </Avatar>

          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleImageChange}
            className="hidden"
          />

          <div
            className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-full cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <Save className="w-6 h-6 text-white" />
          </div>

          {image && (
            <button
              type="button"
              onClick={handleRemoveImage}
              disabled={isRemoving}
              className="absolute top-1 right-1 bg-white rounded-full p-1 shadow-sm hover:bg-gray-100 z-10"
            >
              <X className="w-8 h-8 text-red-500" />
            </button>
          )}
        </div>

        <div>
          <p className="font-semibold text-xl text-[#124A69]">{user.name}</p>
          <p className="text-sm text-gray-500">{formatRole(user.role)}</p>
        </div>

        <div className="flex justify-between mt-4">
          <Button
            variant="outline"
            onClick={onClose}
            className="w-1/2 mr-2 text-[#124A69]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="w-1/2 ml-2 bg-[#003049] hover:bg-[#00263a]"
          >
            {isSaving ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

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
    name: string;
    role: string;
    image?: string | null;
  };
}

export default function EditProfileModal({
  open,
  onClose,
  user,
}: EditProfileModalProps) {
  const [image, setImage] = useState(user.image || "/default-avatar.png");
  const [file, setFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const displayName = user.name || "Loading...";
  const initial = displayName.charAt(0).toUpperCase();

  // Handle selecting a new image with validation
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];

    if (!selected) {
      toast.error("Please upload an image file.");
      return;
    }

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

  // Handle removing image
  const handleRemoveImage = async () => {
    if (!image || image === "/default-avatar.png") return;

    try {
      setIsRemoving(true);
      await fetch("/api/upload", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: image }),
      });
      setImage("/default-avatar.png");
      setFile(null);
      toast.success("Profile image removed.");
    } catch (error) {
      console.error("Error removing image:", error);
      toast.error("Failed to remove image.");
    } finally {
      setIsRemoving(false);
    }
  };

  // Handle saving the profile picture with validation
  const handleSave = async () => {
    if (image === "/default-avatar.png" && !file) {
      toast.error("Please upload a profile image before saving.");
      return;
    }

    setIsSaving(true);
    try {
      let uploadedImageUrl = image;

      if (file) {
        const formData = new FormData();
        formData.append("image", file);

        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!uploadRes.ok) throw new Error("Failed to upload image");

        const uploadData = await uploadRes.json();
        uploadedImageUrl = uploadData.imageUrl;
      }

      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: uploadedImageUrl }),
      });

      if (!res.ok) throw new Error("Failed to update profile");

      toast.success("Profile updated successfully!");
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong while saving.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl text-center">
        <DialogHeader>
          <DialogTitle className="flex justify-center text-2xl font-semibold text-[#124A69]">
            Edit profile
          </DialogTitle>
        </DialogHeader>

        <div className="relative w-55 h-55 group mx-auto mb-4 ">
          {/* Avatar */}
          <Avatar className="w-55 h-55 border-4 border-gray-200">
            <AvatarImage src={image} alt="Profile" className="object-cover" />
            <AvatarFallback className="text-2xl bg-gray-100 text-gray-600 font-medium">
              {initial}
            </AvatarFallback>
          </Avatar>

          {/* Hidden file input */}
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleImageChange}
            className="hidden"
          />

          {/* Hover overlay with Save icon (opens file picker) */}
          <div
            className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-full cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <Save className="w-6 h-6 text-white" />
          </div>

          {/* Remove button */}
          {image !== "/default-avatar.png" && (
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

        {/* Name & Role */}
        <div>
          <p className="font-semibold text-xl text-[#124A69]">{user.name}</p>
          <p className="text-sm text-gray-500">{user.role}</p>
        </div>

        {/* Buttons */}
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

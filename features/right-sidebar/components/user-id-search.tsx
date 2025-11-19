"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, User, Loader2, X } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import axiosInstance from "@/lib/axios";

interface User {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  department: string | null;
  workType: string | null;
  status: string;
}

const LoadingSkeleton = () => (
  <div className="space-y-2">
    <Skeleton className="h-4 w-3/4 bg-white/20" />
    <Skeleton className="h-3 w-1/2 bg-white/20" />
    <Skeleton className="h-3 w-2/3 bg-white/20" />
  </div>
);

export default function UserIdSearch() {
  const [searchQuery, setSearchQuery] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setError("Please enter a user ID");
      return;
    }

    setIsLoading(true);
    setError(null);
    setUser(null);

    try {
      // Search for user by ID - try exact match first
      const response = await axiosInstance.get("/users", {
        params: { search: searchQuery.trim() },
      });

      const users = Array.isArray(response.data)
        ? response.data
        : [response.data];

      // Find exact ID match
      const foundUser = users.find((u: User) => u.id === searchQuery.trim());

      if (foundUser) {
        setUser(foundUser);
      } else if (users.length > 0) {
        // If no exact match but found similar, use first result
        setUser(users[0]);
      } else {
        setError("User not found");
      }
    } catch (err: any) {
      console.error("Error searching user:", err);
      setError(err.response?.data?.error || "Failed to search user");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setSearchQuery("");
    setUser(null);
    setError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  return (
    <Card className="bg-[#124A69] border-white/20 h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-white text-lg flex items-center gap-2">
          <Search className="h-5 w-5" />
          User ID Search
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden flex flex-col">
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="Enter user ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:border-white/40"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClear}
                className="text-white hover:bg-white/20"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <Button
            onClick={handleSearch}
            disabled={isLoading || !searchQuery.trim()}
            className="w-full bg-white/10 hover:bg-white/20 text-white border border-white/20 disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Search
              </>
            )}
          </Button>

          {isLoading && (
            <div className="mt-4">
              <LoadingSkeleton />
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
              <p className="text-sm text-red-200">{error}</p>
            </div>
          )}

          {user && !isLoading && (
            <div className="mt-4 bg-white/10 border border-white/20 rounded-lg p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                  <User className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-white truncate">
                    {user.name || "No name"}
                  </h3>
                  <p className="text-xs text-white/70 truncate">{user.email}</p>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-white/10">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-white/60">User ID:</span>
                  <span className="text-xs font-mono text-white">
                    {user.id}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-white/60">Role:</span>
                  <span className="text-xs text-white font-semibold uppercase">
                    {user.role}
                  </span>
                </div>
                {user.department && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-white/60">Department:</span>
                    <span className="text-xs text-white">
                      {user.department}
                    </span>
                  </div>
                )}
                {user.workType && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-white/60">Work Type:</span>
                    <span className="text-xs text-white">{user.workType}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-xs text-white/60">Status:</span>
                  <span
                    className={`text-xs font-semibold ${
                      user.status === "ACTIVE"
                        ? "text-green-300"
                        : "text-red-300"
                    }`}
                  >
                    {user.status}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

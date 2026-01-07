import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  className?: string;
}

interface UserOption {
  id: string;
  full_name: string;
}

export function MentionInput({
  value,
  onChange,
  placeholder = "Add a comment...",
  rows = 3,
  disabled = false,
  className,
}: MentionInputProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch active users for mentions
  const { data: users = [] } = useQuery({
    queryKey: ["users-for-mention"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .or("status.is.null,status.eq.active")
        .order("full_name");
      if (error) throw error;
      return data as UserOption[];
    },
  });

  // Filter users based on search
  const filteredUsers = users.filter((user) =>
    user.full_name?.toLowerCase().includes(mentionSearch.toLowerCase())
  );

  // Handle textarea input
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    
    onChange(newValue);

    // Check if we're typing after @
    const textBeforeCursor = newValue.slice(0, cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf("@");
    
    if (atIndex !== -1) {
      const textAfterAt = textBeforeCursor.slice(atIndex + 1);
      // Show dropdown if there's @ and no space after it yet
      if (!textAfterAt.includes(" ") && !textAfterAt.includes("\n")) {
        setMentionSearch(textAfterAt);
        setMentionStartIndex(atIndex);
        setShowDropdown(true);
        setSelectedIndex(0);
        return;
      }
    }
    
    setShowDropdown(false);
    setMentionSearch("");
    setMentionStartIndex(-1);
  };

  // Handle selecting a user
  const selectUser = (user: UserOption) => {
    if (mentionStartIndex === -1) return;

    const beforeMention = value.slice(0, mentionStartIndex);
    const cursorPos = textareaRef.current?.selectionStart || value.length;
    const afterMention = value.slice(cursorPos);
    
    // Insert mention with format @[Name](userId)
    const mentionText = `@${user.full_name} `;
    const newValue = beforeMention + mentionText + afterMention;
    
    onChange(newValue);
    setShowDropdown(false);
    setMentionSearch("");
    setMentionStartIndex(-1);

    // Focus and set cursor position
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPos = beforeMention.length + mentionText.length;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showDropdown || filteredUsers.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => 
          prev < filteredUsers.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case "Enter":
        if (showDropdown && filteredUsers[selectedIndex]) {
          e.preventDefault();
          selectUser(filteredUsers[selectedIndex]);
        }
        break;
      case "Escape":
        setShowDropdown(false);
        break;
      case "Tab":
        if (showDropdown && filteredUsers[selectedIndex]) {
          e.preventDefault();
          selectUser(filteredUsers[selectedIndex]);
        }
        break;
    }
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Scroll selected item into view
  useEffect(() => {
    if (showDropdown && dropdownRef.current) {
      const selectedElement = dropdownRef.current.querySelector(
        `[data-index="${selectedIndex}"]`
      );
      selectedElement?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex, showDropdown]);

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        className={className}
      />
      
      {showDropdown && filteredUsers.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 mt-1 w-64 max-h-48 overflow-y-auto rounded-md border bg-popover shadow-lg"
        >
          {filteredUsers.slice(0, 10).map((user, index) => (
            <div
              key={user.id}
              data-index={index}
              onClick={() => selectUser(user)}
              className={cn(
                "px-3 py-2 cursor-pointer text-sm",
                "hover:bg-accent hover:text-accent-foreground",
                index === selectedIndex && "bg-accent text-accent-foreground"
              )}
            >
              <span className="font-medium">@{user.full_name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Helper function to extract mentioned user IDs from comment text
export function extractMentions(text: string, users: { id: string; full_name: string }[]): string[] {
  const mentionedIds: string[] = [];
  const mentionPattern = /@([^\s@]+(?:\s+[^\s@]+)?)/g;
  let match;

  while ((match = mentionPattern.exec(text)) !== null) {
    const mentionedName = match[1].trim();
    // Find user by matching the beginning of their name
    const user = users.find((u) => {
      const fullName = u.full_name?.toLowerCase() || "";
      const searchName = mentionedName.toLowerCase();
      return fullName === searchName || fullName.startsWith(searchName + " ") || fullName.includes(searchName);
    });
    if (user && !mentionedIds.includes(user.id)) {
      mentionedIds.push(user.id);
    }
  }

  return mentionedIds;
}

// Helper function to render comment with highlighted mentions
export function renderCommentWithMentions(content: string): JSX.Element {
  const mentionPattern = /(@[^\s@]+(?:\s+[^\s@]+)?)/g;
  const parts = content.split(mentionPattern);

  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith("@")) {
          return (
            <span
              key={index}
              className="text-primary font-medium"
            >
              {part}
            </span>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </>
  );
}

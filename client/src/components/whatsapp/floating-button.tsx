import { useState, useRef, useEffect } from 'react';
import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FloatingButtonProps {
  onClick: () => void;
  hasNewMessages?: boolean;
  messageCount?: number;
}

export function WhatsAppFloatingButton({ 
  onClick, 
  hasNewMessages = false,
  messageCount = 0 
}: FloatingButtonProps) {
  const [position, setPosition] = useState({ x: window.innerWidth - 100, y: window.innerHeight - 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const buttonRef = useRef<HTMLDivElement>(null);

  // Handle mouse down - start dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  // Handle mouse move - drag
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;

      // Keep button within viewport bounds
      const maxX = window.innerWidth - 70;
      const maxY = window.innerHeight - 70;

      setPosition({
        x: Math.max(20, Math.min(newX, maxX)),
        y: Math.max(20, Math.min(newY, maxY))
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart]);

  // Prevent click event when dragging
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isDragging) {
      onClick();
    }
  };

  return (
    <div
      ref={buttonRef}
      className="fixed z-50"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        cursor: isDragging ? 'grabbing' : 'grab'
      }}
      onMouseDown={handleMouseDown}
      data-testid="whatsapp-floating-button"
    >
      <Button
        onClick={handleClick}
        className="relative h-16 w-16 rounded-full bg-green-500 hover:bg-green-600 text-white shadow-lg transition-all duration-200 hover:scale-110"
        data-testid="button-whatsapp-open"
      >
        {/* WhatsApp Icon */}
        <MessageCircle className="h-8 w-8" />
        
        {/* New Messages Badge */}
        {hasNewMessages && messageCount > 0 && (
          <div className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-red-500 text-white flex items-center justify-center text-xs font-bold border-2 border-white">
            {messageCount > 99 ? '99+' : messageCount}
          </div>
        )}
      </Button>
    </div>
  );
}

// dedupeById.js
export const dedupeById = (arr) => {
  if (!Array.isArray(arr)) return [];
  const map = new Map();
  for (const item of arr) {
    if (!item || !item.id) continue;
    map.set(item.id, item); // last write wins
  }
  return Array.from(map.values());
};


import { useEffect, useRef, useState } from "react";
import { dedupeById } from "@/utils/dedupeById";

export default function Messages({ classroomId, subscribeToMessages, fetchPage }) {
  const [messages, setMessages] = useState([]);
  const unsubRef = useRef(null);

  // one-time subscribe per classroom, with cleanup
  useEffect(() => {
    // Avoid double-subscribe
    if (unsubRef.current) unsubRef.current();

    const onNew = (incoming) => {
      // incoming can be a single message or an array
      setMessages((prev) => {
        const next = Array.isArray(incoming) ? [...prev, ...incoming] : [...prev, incoming];
        return dedupeById(next).sort((a,b) => new Date(a.createdAt) - new Date(b.createdAt));
      });
    };

    const unsub = subscribeToMessages(classroomId, onNew);
    unsubRef.current = unsub;

    return () => {
      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }
    };
  }, [classroomId, subscribeToMessages]);

  // page fetch merge (also de-duped)
  const loadMore = async () => {
    const page = await fetchPage({ classroomId, before: messages[0]?.createdAt });
    setMessages((prev) => {
      const next = [...page, ...prev];
      return dedupeById(next).sort((a,b) => new Date(a.createdAt) - new Date(b.createdAt));
    });
  };

  // stable key usage
  return (
    <div>
      {messages.map((m) => (
        <MessageRow key={m.id} {...m} />
      ))}
      <button onClick={loadMore}>Load older</button>
    </div>
  );
}

// Example with a simple "loaded" ref guard
const loadedRef = useRef(false);
useEffect(() => {
  if (loadedRef.current) return; // prevents duplicate initial fetch
  loadedRef.current = true;

  (async () => {
    const initial = await fetchPage({ classroomId });
    setMessages(dedupeById(initial).sort((a,b) => new Date(a.createdAt) - new Date(b.createdAt)));
  })();
}, [classroomId]);

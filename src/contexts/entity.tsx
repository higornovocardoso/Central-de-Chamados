import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePermissions } from "@/hooks/usePermissions";
import type { MyEntity } from "@/lib/permissions";

const STORAGE_KEY = "glpi.entity";

type EntityContextValue = {
  /** Entidades que o usuário enxerga, já em ordem de árvore. */
  entities: MyEntity[];
  /** null significa "todas as entidades visíveis", como a raiz em árvore do GLPI. */
  selectedId: string | null;
  selected: MyEntity | null;
  setSelectedId: (id: string | null) => void;
  loading: boolean;
};

const EntityContext = createContext<EntityContextValue>({
  entities: [],
  selectedId: null,
  selected: null,
  setSelectedId: () => {},
  loading: true,
});

export function EntityProvider({ children }: { children: ReactNode }) {
  const { entities, loading } = usePermissions();
  const [selectedId, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setSelected(stored);
  }, []);

  // Se a entidade guardada deixou de ser visível, volta para a árvore inteira.
  useEffect(() => {
    if (!loading && selectedId && !entities.some((e) => e.id === selectedId)) {
      setSelected(null);
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [loading, selectedId, entities]);

  function setSelectedId(id: string | null) {
    setSelected(id);
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
  }

  const value = useMemo<EntityContextValue>(
    () => ({
      entities,
      selectedId,
      selected: entities.find((e) => e.id === selectedId) ?? null,
      setSelectedId,
      loading,
    }),
    [entities, selectedId, loading],
  );

  return <EntityContext.Provider value={value}>{children}</EntityContext.Provider>;
}

export function useEntity() {
  return useContext(EntityContext);
}

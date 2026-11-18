"use client";
import { useBackdrop } from "@/lib/client/backdrop";

/** Full-bleed blurred artwork behind everything; crossfades when the artwork changes. */
export function Backdrop() {
  const { current, previous } = useBackdrop();
  return (
    <div className="backdrop" aria-hidden="true">
      <div className="backdrop__mesh" />
      {previous && <div className="backdrop__layer" style={{ backgroundImage: `url("${previous}")` }} />}
      {current && <div key={current} className="backdrop__layer backdrop__layer--in" style={{ backgroundImage: `url("${current}")` }} />}
      <div className="backdrop__veil" />
    </div>
  );
}

"use client";

import { useLayoutEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const blocks = "[data-motion='reveal'],main article,main section section,main > section > header,main > section > div,main > section aside,main [role='tabpanel']";
const excluded = "main > aside,main > header,[role='dialog'],[data-motion='off'],.fc,svg,[aria-busy='true']";

export default function CrmMotion() {
  const pathname = usePathname();
  const mounted = useRef(false);
  const visited = useRef(new WeakSet<HTMLElement>());

  useLayoutEffect(() => {
    const routeChange = mounted.current;
    mounted.current = true;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (typeof IntersectionObserver === "undefined" || typeof Element.prototype.animate !== "function") return;
    const waiting = new Set<HTMLElement>();
    const queued = new Set<HTMLElement>();
    const animations = new Map<HTMLElement, Animation>();
    const touched = new Set<HTMLElement>();
    let playFrame = 0;
    let observer: IntersectionObserver | null = null;
    const tokens = getComputedStyle(document.documentElement);
    const milliseconds = (name: string, fallback: number) => {
      const value = tokens.getPropertyValue(name).trim(), number = parseFloat(value);
      return Number.isFinite(number) ? number * (value.endsWith("ms") ? 1 : value.endsWith("s") ? 1000 : 1) : fallback;
    };
    const duration = milliseconds("--motion-reveal-duration", 780);
    const stagger = milliseconds("--motion-stagger", 60);
    const easing = tokens.getPropertyValue("--motion-ease-out").trim() || "cubic-bezier(0.22, 1, 0.36, 1)";

    const show = (element: HTMLElement) => {
      observer?.unobserve(element); waiting.delete(element); queued.delete(element);
      element.dataset.crmMotion = "revealed";
    };
    const finishAll = () => {
      cancelAnimationFrame(playFrame); playFrame = 0;
      for (const node of waiting) show(node);
      for (const node of queued) show(node);
      for (const [node, animation] of animations) { show(node); animation.cancel(); }
      animations.clear();
    };
    const play = (element: HTMLElement, delay: number) => {
      if (!element.isConnected) { show(element); return; }
      if (preference.matches || element.closest(excluded) || element.contains(document.activeElement)) { show(element); return; }
      const prepared = element.dataset.crmMotion === "waiting";
      const stationary = element.dataset.crmMotionKind === "stationary";
      // Never dim content that has already been painted. It may only move gently.
      const frames: Keyframe[] = prepared
        ? [{ opacity: 0, ...(stationary ? {} : { translate: "0 18px" }) }, { opacity: 1, ...(stationary ? {} : { translate: "0 0" }) }]
        : [{ translate: stationary ? "none" : "0 10px" }, { translate: stationary ? "none" : "0 0" }];
      element.dataset.crmMotion = "playing";
      try {
        const animation = element.animate(frames, { duration, delay, easing, fill: "backwards" });
        animation.id = "crm-reveal";
        animations.set(element, animation);
        const release = () => { if (animations.get(element) === animation) { animations.delete(element); show(element); } };
        animation.onfinish = release; animation.oncancel = release;
      } catch { show(element); }
    };
    const enqueue = (element: HTMLElement) => {
      observer?.unobserve(element); waiting.delete(element); queued.add(element);
      if (playFrame) return;
      playFrame = requestAnimationFrame(() => {
        playFrame = 0;
        const batch = [...queued].filter(node => node.isConnected);
        queued.clear();
        batch.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
        batch.forEach((node, index) => play(node, Math.min(index, 3) * stagger));
      });
    };
    const scan = (freshRoots: HTMLElement[] = [], enteringRoute = false) => {
      if (preference.matches) return;
      for (const node of touched) if (!node.isConnected) touched.delete(node);
      for (const node of waiting) if (!node.isConnected) { show(node); touched.delete(node); }
      for (const [node, animation] of animations) if (!node.isConnected) { animation.cancel(); animations.delete(node); touched.delete(node); }
      const candidates = new Set<HTMLElement>();
      const positions = new Map<HTMLElement, DOMRect>();
      const styles = new Map<HTMLElement, CSSStyleDeclaration>();
      const structural = new Set(document.querySelectorAll<HTMLElement>(blocks));
      // Recognize small card surfaces as well as semantic sections, not entire grids.
      const nodes = new Set([...structural, ...document.querySelectorAll<HTMLElement>("main div,main button")]);
      for (const node of nodes) {
        if (node.closest(excluded) || node.matches("[role='status'],[role='alert'],[role='group'],[role='tablist']")) continue;
        const rect = node.getBoundingClientRect();
        if (rect.height < 36 || rect.width < 40) continue;
        const style = getComputedStyle(node);
        if (style.visibility === "hidden" || style.display === "none") continue;
        const surface = !["absolute", "fixed"].includes(style.position) && rect.height >= 60 && rect.width >= 90 && node.children.length >= 2 &&
          parseFloat(style.borderTopLeftRadius) >= 10 &&
          (parseFloat(style.borderTopWidth) > 0 || style.backgroundImage !== "none" || !["transparent", "rgba(0, 0, 0, 0)"].includes(style.backgroundColor));
        if (!structural.has(node) && !surface) continue;
        candidates.add(node); positions.set(node, rect); styles.set(node, style);
      }
      const containers = new Set<HTMLElement>();
      for (const node of candidates) for (let parent = node.parentElement; parent; parent = parent.parentElement) if (candidates.has(parent)) containers.add(parent);
      // Async smaller cards must never fade together with their already-visible parent.
      for (const node of containers) {
        if (waiting.has(node) || queued.has(node)) show(node);
        animations.get(node)?.finish();
      }
      for (const node of candidates) {
        if (visited.current.has(node) || containers.has(node)) continue;
        visited.current.add(node); touched.add(node);
        const rect = positions.get(node)!;
        const positioned = [node, ...node.querySelectorAll<HTMLElement>("aside,header,[data-motion-sticky]")];
        const stationary = positioned.some(item => ["sticky", "fixed"].includes((styles.get(item) ?? getComputedStyle(item)).position));
        if (stationary) node.dataset.crmMotionKind = "stationary";
        const focused = node.contains(document.activeElement);
        const belowFold = rect.top >= window.innerHeight;
        const newlyInserted = freshRoots.some(root => root === node || root.contains(node));
        if (!focused && (belowFold || enteringRoute || newlyInserted)) {
          // Synchronous preparation before paint, never from IntersectionObserver.
          node.dataset.crmMotion = "waiting";
        } else node.dataset.crmMotion = "visible";
        if (rect.bottom <= 0 || focused) { show(node); continue; }
        waiting.add(node); observer?.observe(node);
      }
    };
    const configure = (enteringRoute = false) => {
      observer?.disconnect(); finishAll();
      if (preference.matches) return;
      observer = new IntersectionObserver(entries => {
        for (const entry of entries) if (entry.isIntersecting) enqueue(entry.target as HTMLElement);
      }, { threshold: 0, rootMargin: "0px 0px -24px 0px" });
      scan([], enteringRoute);
    };
    const mutations = new MutationObserver(records => {
      if (preference.matches) return;
      const relevant = records.filter(record => !(record.target instanceof Element) || !record.target.closest(excluded));
      const fresh = relevant.flatMap(record => [...record.addedNodes].filter((node): node is HTMLElement => node instanceof HTMLElement));
      if (fresh.length || relevant.some(record => record.type === "attributes")) scan(fresh);
    });
    mutations.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-busy"] });
    const finishInteraction = (event: Event) => {
      if (!(event.target instanceof Node)) return;
      const target = event.target;
      for (const node of [...waiting, ...queued]) if (node.contains(target)) show(node);
      for (const [node, animation] of animations) if (node.contains(target)) { animation.finish(); show(node); }
    };
    const preferenceChanged = () => configure();
    const visibilityChanged = () => { if (document.hidden) finishAll(); };
    preference.addEventListener("change", preferenceChanged);
    document.addEventListener("focusin", finishInteraction);
    document.addEventListener("pointerdown", finishInteraction, true);
    document.addEventListener("visibilitychange", visibilityChanged);
    configure(routeChange);
    return () => {
      mutations.disconnect(); observer?.disconnect(); finishAll();
      for (const node of touched) { delete node.dataset.crmMotionKind; if (node.dataset.crmMotion !== "revealed") show(node); }
      preference.removeEventListener("change", preferenceChanged);
      document.removeEventListener("focusin", finishInteraction);
      document.removeEventListener("pointerdown", finishInteraction, true);
      document.removeEventListener("visibilitychange", visibilityChanged);
    };
  }, [pathname]);

  return null;
}

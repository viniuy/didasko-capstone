import { useRef, useEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const AnimatedContent = ({
  children,
  container,
  distance = 100,
  direction = "vertical",
  reverse = false,
  duration = 0.8,
  ease = "power3.out",
  initialOpacity = 0,
  animateOpacity = true,
  scale = 1,
  threshold = 0.1,
  delay = 0,
  disappearAfter = 0,
  disappearDuration = 0.5,
  disappearEase = "power3.in",
  onComplete,
  onDisappearanceComplete,
  className = "",
  ...props
}) => {
  const ref = useRef(null);
  const hasAnimatedRef = useRef(false);
  const scrollTriggerRef = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Check if element is already animated (using data attribute for persistence)
    const isAlreadyAnimated =
      hasAnimatedRef.current || el.dataset.animated === "true";

    // If already animated, ensure element is in final state and don't re-animate
    if (isAlreadyAnimated) {
      hasAnimatedRef.current = true;
      el.dataset.animated = "true";
      gsap.set(el, {
        x: 0,
        y: 0,
        scale: 1,
        opacity: 1,
        visibility: "visible",
      });
      return () => {
        // No cleanup needed if already animated
      };
    }

    // If ScrollTrigger already exists, don't recreate
    if (scrollTriggerRef.current) {
      return () => {
        // Keep existing ScrollTrigger
      };
    }

    let scrollerTarget =
      container || document.getElementById("snap-main-container") || null;

    if (typeof scrollerTarget === "string") {
      scrollerTarget = document.querySelector(scrollerTarget);
    }

    const axis = direction === "horizontal" ? "x" : "y";
    const offset = reverse ? -distance : distance;
    const startPct = (1 - threshold) * 100;

    gsap.set(el, {
      [axis]: offset,
      scale,
      opacity: animateOpacity ? initialOpacity : 1,
      visibility: "visible",
    });

    const tl = gsap.timeline({
      paused: true,
      delay,
      onComplete: () => {
        hasAnimatedRef.current = true;
        el.dataset.animated = "true";
        if (onComplete) onComplete();
        if (disappearAfter > 0) {
          gsap.to(el, {
            [axis]: reverse ? distance : -distance,
            scale: 0.8,
            opacity: animateOpacity ? initialOpacity : 0,
            delay: disappearAfter,
            duration: disappearDuration,
            ease: disappearEase,
            onComplete: () => onDisappearanceComplete?.(),
          });
        }
      },
    });

    tl.to(el, {
      [axis]: 0,
      scale: 1,
      opacity: 1,
      duration,
      ease,
    });

    // Check if element is already in viewport
    const checkIfInView = () => {
      const rect = el.getBoundingClientRect();
      const scrollerRect = scrollerTarget
        ? scrollerTarget.getBoundingClientRect()
        : { top: 0, bottom: window.innerHeight };
      const scrollerHeight = scrollerTarget
        ? scrollerTarget.scrollHeight
        : window.innerHeight;
      const scrollerTop = scrollerTarget
        ? scrollerTarget.scrollTop
        : window.scrollY;

      const elementTop = rect.top - scrollerRect.top + scrollerTop;
      const viewportTop = scrollerTop;
      const viewportBottom =
        scrollerTop +
        (scrollerTarget ? scrollerTarget.clientHeight : window.innerHeight);
      const thresholdPoint = viewportTop + scrollerHeight * threshold;

      return elementTop < thresholdPoint;
    };

    // If already in viewport, animate immediately
    if (checkIfInView() && !hasAnimatedRef.current) {
      hasAnimatedRef.current = true;
      el.dataset.animated = "true";
      tl.play();
      return () => {
        tl.kill();
      };
    }

    const st = ScrollTrigger.create({
      trigger: el,
      scroller: scrollerTarget,
      start: `top ${startPct}%`,
      once: true,
      onEnter: () => {
        if (!hasAnimatedRef.current) {
          hasAnimatedRef.current = true;
          el.dataset.animated = "true";
          tl.play();
        }
      },
    });

    scrollTriggerRef.current = st;

    return () => {
      // Only cleanup on unmount, not on re-render if already animated
      if (!hasAnimatedRef.current) {
        if (scrollTriggerRef.current) {
          scrollTriggerRef.current.kill();
          scrollTriggerRef.current = null;
        }
        tl.kill();
      }
    };
  }, [
    container,
    distance,
    direction,
    reverse,
    duration,
    ease,
    initialOpacity,
    animateOpacity,
    scale,
    threshold,
    delay,
    disappearAfter,
    disappearDuration,
    disappearEase,
    onComplete,
    onDisappearanceComplete,
  ]);

  return (
    <div
      ref={ref}
      className={className}
      style={{ visibility: "hidden" }}
      {...props}
    >
      {children}
    </div>
  );
};

export default AnimatedContent;

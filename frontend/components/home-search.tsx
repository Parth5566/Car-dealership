"use client";

import { useState } from "react";
import { ArrowRight, CarFront, Search } from "lucide-react";

export function HomeSearch() {
  const [type, setType] = useState<"passenger" | "commercial">("passenger");
  const commercial = type === "commercial";

  return (
    <form
      action={commercial ? "/commercial" : "/cars"}
      className="home-search"
      aria-label={
        commercial ? "Search commercial cabs" : "Search passenger cars"
      }
    >
      <div
        className="vehicle-type-choice"
        role="group"
        aria-label="Choose vehicle category"
      >
        <button
          type="button"
          aria-pressed={!commercial}
          onClick={() => setType("passenger")}
        >
          <CarFront size={18} /> Passenger cars
        </button>
        <button
          type="button"
          aria-pressed={commercial}
          onClick={() => setType("commercial")}
        >
          <CarFront size={18} /> Commercial cabs
        </button>
      </div>
      <div className="search-intro">
        <Search size={21} />
        <strong>
          {commercial ? "Find a commercial cab" : "Find a passenger car"}
        </strong>
      </div>
      <label>
        <span>Brand, model or keyword</span>
        <input
          name="q"
          placeholder={commercial ? "e.g. Dzire" : "e.g. Swift"}
          aria-label="Brand, model or keyword"
          maxLength={100}
        />
      </label>
      <label>
        <span>Your budget</span>
        <select name="max_price" defaultValue="">
          <option value="">Any budget</option>
          <option value="500000">Up to ₹5 lakh</option>
          <option value="1000000">Up to ₹10 lakh</option>
          <option value="2000000">Up to ₹20 lakh</option>
        </select>
      </label>
      <button className="btn primary" type="submit">
        {commercial ? "Search commercial" : "Search passenger cars"}{" "}
        <ArrowRight size={17} />
      </button>
    </form>
  );
}

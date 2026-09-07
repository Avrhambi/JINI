import json
from concurrent.futures import ThreadPoolExecutor
import os
from google import genai
from google.genai import types 


class SearchEngine:
    def __init__(self, storage, embedder, query_agent_api_key, search_agent_api_key, query_model_name, search_model_name):
        self.storage = storage
        self.embedder = embedder
        self.query_client = genai.Client(api_key=query_agent_api_key)
        self.search_agent_client = genai.Client(api_key=search_agent_api_key)
        self.query_model_name = query_model_name
        self.search_model_name = search_model_name
        self.threshold = 7.5

        # schema for Gemini judge response 
        self.response_schema = {
            "type": "OBJECT",
            "properties": {
                "identified_matches": {
                    "type": "ARRAY",
                    "items": {
                        "type": "OBJECT",
                        "properties": {
                            "sentence_id": {
                                "type": "INTEGER",
                                "description": "The ID [0-5] of the specific sentence in the block."
                            },
                            "step_1_inventory": {
                                "type": "STRING", 
                                "description": "Keywords found specifically in THIS sentence."
                            },
                            "step_2_resolution": {
                                "type": "STRING", 
                                "description": "Pronoun mapping using the whole block context (e.g., 'he' -> 'Alex')."
                            },
                            "reasoning": {
                                "type": "STRING", 
                                "description": "Bridge Test logic for this specific sentence."
                            },
                            "score": {
                                "type": "NUMBER",
                                "description": "Score 0.0-10.0 for this sentence specifically."
                            }
                        },
                        "required": ["sentence_id", "step_1_inventory", "step_2_resolution", "reasoning", "score"]
                    }
                }
            },
            "required": ["identified_matches"]
        }

        # instructions for judge agent 
        self.system_instruction = os.getenv("SYSTEM_INSTRUCTIONS")
        # instructions for query refiner
        self.refine_promt = os.getenv("REFINE_PROMT")
 
    def refine_query(self, query):
        """
        Refines the user's query into exact keywords and a semantic focus sentence 
        """
        
        refine_prompt = self.refine_promt + f"""
        QUERY: "{query}"

        RETURN JSON ONLY:
        {{
        "exact_keywords": ["anchor1", "root1", "anchor2", "..."], 
        "semantic_focus": "A clean, descriptive semantic sentence in Hebrew that defines the domain"
        }}
        """

        try:
            response = self.query_client.models.generate_content(
                model=self.query_model_name,
                contents=refine_prompt,
                config=types.GenerateContentConfig(response_mime_type="application/json")
            )
            data = json.loads(response.text)

            if isinstance(data, list) and len(data) > 0:
                data = data[0]

            if not isinstance(data, dict):
                return {"exact_keywords": [query], "semantic_focus": query}
            
            return data
        except Exception as e:
            print(f"Error refining query: {e}")
            return {"exact_keywords": [query], "semantic_focus": query}


    def gemini_judge_worker(self, query, res, user_id):
        """
        analyzes a single candidate block with the search agent and returns scored matches 
        for sentences within that block, applying the defined scoring rules and reasoning protocol
        """

        try: 
            # seprating the block to sentenceses
            sentences_text = "\n".join([f"[{i}]: {s['text']}" for i, s in enumerate(res['sentences'])])
            
            config = types.GenerateContentConfig(
                system_instruction=self.system_instruction,
                response_mime_type="application/json",
                response_schema=self.response_schema,
                temperature=0,
                thinking_config=types.ThinkingConfig(include_thoughts=False)
            )

            prompt = f"QUERY: '{query}'\n\nBLOCK:\n{sentences_text}"
            
            response = self.search_agent_client.models.generate_content(
                model=self.search_model_name,
                contents=[prompt],
                config=config
            )
            data = json.loads(response.text)
            
            # collecting matching sentences from the block based on score
            matches_from_block = []
            for match in data.get('identified_matches', []):
                s_id = match['sentence_id']
                if s_id >= len(res['sentences']): continue
                
                score = float(match['score'])
                if score < self.threshold: continue # strict thresholding to enforce high precision

                sentence_data = res['sentences'][s_id]
                
                matches_from_block.append({
                    "text": sentence_data['text'],
                    "start": sentence_data['start'],
                    "end": sentence_data['end'],
                    "score": score,
                    "user_id": user_id,
                    "reasoning": f"ST1: {match['step_1_inventory']} | ST2: {match['step_2_resolution']} | ST3: {match['reasoning']}",
                    "file_name": res.get("file_name", "unknown")
                })
            return matches_from_block
        except Exception as e:
            print(f"Error in judge worker: {e}")
            return []


    def _deduplicate_sentences(self, matches):
        """
        helper function to deduplicate matches at the sentence level, ensuring that if multiple blocks 
        contain the same sentence, only the highest-scoring match is kept
        """
        unique_matches = {}
        for match in matches:
            unique_key = f"{match['file_name']}_{round(match['start'], 2)}"
            if unique_key not in unique_matches or match['score'] > unique_matches[unique_key]['score']:
                unique_matches[unique_key] = match

        return list(unique_matches.values())


    def rerank_results(self, query, user_id, candidates, k):
        """
        performs the re-ranking of candidate blocks by sending them to the Gemini judge agent, 
        applying strict thresholding, and then deduplicating matches at the sentence level 
        to ensure high precision in the final search results
        """        

        # duplicate filtering at the block level
        seen_blocks = set()
        unique_targets = []
        for c in candidates:
            b_id = c.get('block_id', f"{c['file_name']}_{c['sentences'][0]['start']}")
            if b_id not in seen_blocks:
                unique_targets.append(c)
                seen_blocks.add(b_id)

        targets = unique_targets[:15] 
        all_matches = []

        # parallelize the judge agent calls for efficiency
        with ThreadPoolExecutor(max_workers=min(len(targets), 15)) as executor:
            list_of_results = list(executor.map(lambda c: self.gemini_judge_worker(query, c, user_id), targets))
            for sublist in list_of_results:
                if sublist:
                    all_matches.extend(sublist)
        
        final_results = self._deduplicate_sentences(all_matches)
        top_k_by_score = sorted(final_results, key=lambda x: x['score'], reverse=True)[:k]  # return only top k
        chronological_final = sorted(top_k_by_score, key=lambda x: x["start"])
        return chronological_final

    def search(self, query: str, user_id:str, top_k=5):
        refined = self.refine_query(query)
        exact_terms = refined.get("exact_keywords", [query])
        
        candidates = []

        # 1. textual search with exact keywords
        for term in exact_terms:
            candidates.extend(self.storage.exact_search(term, user_id=user_id))
        
        # 2. semantic vector search 
        q_vec = self.embedder.encode(f"query: {refined.get('semantic_focus', query)}", normalize_embeddings=True)
        candidates.extend(self.storage.vector_search(q_vec, user_id=user_id))
        
        if not candidates:
            print("No candidates found.")
            return []

        # 3. re-ranking of candidates 
        return self.rerank_results(query, user_id, candidates, top_k)


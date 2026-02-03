"""
Firestore Database Service
===========================
Drop-in replacement for MongoDB using Google Cloud Firestore.
Provides a MongoDB-like interface for easy migration.
"""

import os
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime
from google.cloud import firestore
from google.cloud.firestore_v1 import FieldFilter

logger = logging.getLogger(__name__)

# Initialize Firestore client
# On Cloud Run, this automatically uses the service account
# Locally, set GOOGLE_APPLICATION_CREDENTIALS env var
_firestore_client = None

def get_firestore_client():
    """Get or create Firestore client"""
    global _firestore_client
    if _firestore_client is None:
        try:
            # Try to get project ID from environment or metadata
            project_id = os.environ.get('GOOGLE_CLOUD_PROJECT', 'moneysaarthi')
            _firestore_client = firestore.Client(project=project_id)
            logger.info(f"✅ Firestore connected to project: {project_id}")
        except Exception as e:
            logger.error(f"❌ Firestore connection error: {e}")
            raise
    return _firestore_client


class FirestoreCollection:
    """
    MongoDB-like collection interface for Firestore.
    Provides find, find_one, insert_one, update_one, delete_one, etc.
    """
    
    def __init__(self, collection_name: str):
        self.collection_name = collection_name
        self._client = None
    
    @property
    def client(self):
        if self._client is None:
            self._client = get_firestore_client()
        return self._client
    
    @property
    def collection(self):
        return self.client.collection(self.collection_name)
    
    def _doc_to_dict(self, doc) -> Optional[Dict]:
        """Convert Firestore document to dict"""
        if doc.exists:
            data = doc.to_dict()
            data['_id'] = doc.id  # Add document ID as _id for MongoDB compatibility
            return data
        return None
    
    def _apply_projection(self, data: Dict, projection: Optional[Dict]) -> Dict:
        """Apply MongoDB-style projection to data"""
        if not projection or not data:
            return data
        
        # Check if projection is exclusion (has 0 values) or inclusion (has 1 values)
        has_exclusion = any(v == 0 for v in projection.values() if isinstance(v, int))
        
        if has_exclusion:
            # Exclusion projection - remove specified fields
            return {k: v for k, v in data.items() if projection.get(k, 1) != 0}
        else:
            # Inclusion projection - only include specified fields
            result = {}
            for key, include in projection.items():
                if include and key in data:
                    result[key] = data[key]
            # Always include _id unless explicitly excluded
            if '_id' in data and projection.get('_id', 1) != 0:
                result['_id'] = data['_id']
            return result
    
    async def find_one(self, filter_dict: Dict, projection: Optional[Dict] = None) -> Optional[Dict]:
        """Find a single document matching the filter"""
        try:
            # Build query
            query = self.collection
            
            for key, value in filter_dict.items():
                if key != '_id':
                    query = query.where(filter=FieldFilter(key, '==', value))
            
            # If filtering by _id, get document directly
            if '_id' in filter_dict:
                doc = self.collection.document(filter_dict['_id']).get()
                data = self._doc_to_dict(doc)
            else:
                docs = query.limit(1).stream()
                data = None
                for doc in docs:
                    data = self._doc_to_dict(doc)
                    break
            
            if data and projection:
                data = self._apply_projection(data, projection)
            
            return data
        except Exception as e:
            logger.error(f"Firestore find_one error in {self.collection_name}: {e}")
            return None
    
    def find(self, filter_dict: Optional[Dict] = None, projection: Optional[Dict] = None):
        """Return a cursor-like object for finding multiple documents"""
        return FirestoreCursor(self, filter_dict or {}, projection)
    
    async def insert_one(self, document: Dict) -> Dict:
        """Insert a single document"""
        try:
            # Generate a unique ID if not provided
            doc_id = document.pop('_id', None) or document.get('id') or self._generate_id(document)
            
            # Add timestamps
            document['created_at'] = document.get('created_at', datetime.utcnow().isoformat())
            document['updated_at'] = datetime.utcnow().isoformat()
            
            # Insert document
            self.collection.document(doc_id).set(document)
            
            document['_id'] = doc_id
            logger.debug(f"Inserted document {doc_id} into {self.collection_name}")
            return {'inserted_id': doc_id}
        except Exception as e:
            logger.error(f"Firestore insert_one error in {self.collection_name}: {e}")
            raise
    
    async def update_one(self, filter_dict: Dict, update: Dict, upsert: bool = False) -> Dict:
        """Update a single document"""
        try:
            # Find the document first
            doc_data = await self.find_one(filter_dict)
            
            if doc_data:
                doc_id = doc_data['_id']
                
                # Handle MongoDB-style $set operator
                if '$set' in update:
                    update_data = update['$set']
                else:
                    update_data = update
                
                update_data['updated_at'] = datetime.utcnow().isoformat()
                
                self.collection.document(doc_id).update(update_data)
                return {'modified_count': 1, 'matched_count': 1}
            elif upsert:
                # Create new document
                await self.insert_one({**filter_dict, **update.get('$set', update)})
                return {'modified_count': 0, 'matched_count': 0, 'upserted_id': True}
            
            return {'modified_count': 0, 'matched_count': 0}
        except Exception as e:
            logger.error(f"Firestore update_one error in {self.collection_name}: {e}")
            raise
    
    async def delete_one(self, filter_dict: Dict) -> Dict:
        """Delete a single document"""
        try:
            doc_data = await self.find_one(filter_dict)
            
            if doc_data:
                doc_id = doc_data['_id']
                self.collection.document(doc_id).delete()
                return {'deleted_count': 1}
            
            return {'deleted_count': 0}
        except Exception as e:
            logger.error(f"Firestore delete_one error in {self.collection_name}: {e}")
            raise
    
    async def delete_many(self, filter_dict: Dict) -> Dict:
        """Delete multiple documents"""
        try:
            deleted = 0
            query = self.collection
            
            for key, value in filter_dict.items():
                if key != '_id':
                    query = query.where(filter=FieldFilter(key, '==', value))
            
            docs = query.stream()
            for doc in docs:
                doc.reference.delete()
                deleted += 1
            
            return {'deleted_count': deleted}
        except Exception as e:
            logger.error(f"Firestore delete_many error in {self.collection_name}: {e}")
            raise
    
    async def count_documents(self, filter_dict: Optional[Dict] = None) -> int:
        """Count documents matching filter"""
        try:
            query = self.collection
            
            if filter_dict:
                for key, value in filter_dict.items():
                    if key != '_id':
                        query = query.where(filter=FieldFilter(key, '==', value))
            
            # Count by streaming (Firestore doesn't have native count)
            count = 0
            for _ in query.stream():
                count += 1
            return count
        except Exception as e:
            logger.error(f"Firestore count_documents error: {e}")
            return 0
    
    def _generate_id(self, document: Dict) -> str:
        """Generate a unique ID for a document"""
        # Use specific fields if available
        if 'user_id' in document:
            return document['user_id']
        if 'session_token' in document:
            return document['session_token'][:50]  # Truncate long tokens
        if 'payment_id' in document:
            return document['payment_id']
        if 'email' in document:
            return document['email'].replace('@', '_at_').replace('.', '_')
        
        # Generate random ID
        import uuid
        return str(uuid.uuid4())


class FirestoreCursor:
    """MongoDB-like cursor for Firestore queries"""
    
    def __init__(self, collection: FirestoreCollection, filter_dict: Dict, projection: Optional[Dict] = None):
        self.collection = collection
        self.filter_dict = filter_dict
        self.projection = projection
        self._limit = None
        self._sort = None
        self._skip = 0
    
    def limit(self, count: int):
        """Limit the number of results"""
        self._limit = count
        return self
    
    def sort(self, key_or_list, direction=None):
        """Sort results"""
        if isinstance(key_or_list, str):
            self._sort = [(key_or_list, direction or 1)]
        else:
            self._sort = key_or_list
        return self
    
    def skip(self, count: int):
        """Skip first N results"""
        self._skip = count
        return self
    
    async def to_list(self, length: Optional[int] = None) -> List[Dict]:
        """Execute query and return results as list"""
        try:
            query = self.collection.collection
            
            # Apply filters
            for key, value in self.filter_dict.items():
                if key == '_id':
                    continue
                if isinstance(value, dict):
                    # Handle operators like $gte, $lte, etc.
                    for op, val in value.items():
                        if op == '$gte':
                            query = query.where(filter=FieldFilter(key, '>=', val))
                        elif op == '$lte':
                            query = query.where(filter=FieldFilter(key, '<=', val))
                        elif op == '$gt':
                            query = query.where(filter=FieldFilter(key, '>', val))
                        elif op == '$lt':
                            query = query.where(filter=FieldFilter(key, '<', val))
                        elif op == '$ne':
                            query = query.where(filter=FieldFilter(key, '!=', val))
                        elif op == '$in':
                            query = query.where(filter=FieldFilter(key, 'in', val))
                else:
                    query = query.where(filter=FieldFilter(key, '==', value))
            
            # Apply sorting
            if self._sort:
                for field, direction in self._sort:
                    query = query.order_by(field, direction=firestore.Query.DESCENDING if direction == -1 else firestore.Query.ASCENDING)
            
            # Apply limit
            limit = length or self._limit
            if limit:
                query = query.limit(limit + self._skip)  # Account for skip
            
            # Execute query
            results = []
            count = 0
            for doc in query.stream():
                if count < self._skip:
                    count += 1
                    continue
                
                data = doc.to_dict()
                data['_id'] = doc.id
                
                if self.projection:
                    data = self.collection._apply_projection(data, self.projection)
                
                results.append(data)
                count += 1
                
                if limit and len(results) >= limit:
                    break
            
            return results
        except Exception as e:
            logger.error(f"Firestore to_list error: {e}")
            return []


class FirestoreDatabase:
    """
    MongoDB-like database interface for Firestore.
    Access collections as attributes: db.users, db.watchlist, etc.
    """
    
    def __init__(self):
        self._collections = {}
    
    def __getattr__(self, name: str) -> FirestoreCollection:
        """Get a collection by name"""
        if name.startswith('_'):
            raise AttributeError(name)
        
        if name not in self._collections:
            self._collections[name] = FirestoreCollection(name)
        
        return self._collections[name]
    
    def __getitem__(self, name: str) -> FirestoreCollection:
        """Get a collection by name using bracket notation"""
        return self.__getattr__(name)


# Create global database instance
db = FirestoreDatabase()


def get_db():
    """Get the Firestore database instance"""
    return db


async def check_connection() -> bool:
    """Check if Firestore connection is working"""
    try:
        client = get_firestore_client()
        # Try a simple operation
        list(client.collections())[:1]
        return True
    except Exception as e:
        logger.error(f"Firestore connection check failed: {e}")
        return False

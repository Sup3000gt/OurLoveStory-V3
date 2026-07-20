export type Visibility = 'public' | 'private';
export type MediaType = 'image' | 'video';

export interface MemoryAsset {
  id: string;
  type: MediaType;
  src: string;
  originalUrl: string;
  filename: string;
}

export interface Memory {
  id: string;
  title: string;
  location: string;
  date: string;
  description: string;
  category: 'Travel' | 'Daily Life' | 'Homemade Food' | 'Dining Out' | 'Special Moments';
  visibility: Visibility;
  featured: boolean;
  cover: string;
  assets: MemoryAsset[];
}

export const demoMemories: Memory[] = [
  {
    id: 'how-we-met', title: 'How We Met', location: 'Seattle, Washington', date: '2023-03-12',
    description: 'The beginning of our favorite story.', category: 'Special Moments', visibility: 'public', featured: true,
    cover: '/media/seattle.jpg', assets: [{ id: 'a1', type: 'image', src: '/media/seattle.jpg', originalUrl: '/media/seattle.jpg', filename: 'how-we-met.jpg' }]
  },
  {
    id: 'weekend-getaway', title: 'Weekend Getaway', location: 'Lake Tahoe, California', date: '2024-05-24',
    description: 'A quiet weekend surrounded by mountains and water.', category: 'Travel', visibility: 'public', featured: true,
    cover: '/media/tahoe.jpg', assets: [{ id: 'a2', type: 'image', src: '/media/tahoe.jpg', originalUrl: '/media/tahoe.jpg', filename: 'lake-tahoe.jpg' }]
  },
  {
    id: 'coffee-conversations', title: 'Coffee & Conversations', location: 'New York, New York', date: '2024-04-08',
    description: 'Warm coffee and nowhere else we needed to be.', category: 'Dining Out', visibility: 'public', featured: true,
    cover: '/media/coffee.jpg', assets: [{ id: 'a3', type: 'image', src: '/media/coffee.jpg', originalUrl: '/media/coffee.jpg', filename: 'coffee-conversations.jpg' }]
  },
  {
    id: 'sunset-walk', title: 'Sunset Walk', location: 'Santa Monica, California', date: '2024-02-18',
    description: 'An ordinary walk that became one of our favorite evenings.', category: 'Daily Life', visibility: 'public', featured: false,
    cover: '/media/sunset.jpg', assets: [{ id: 'a4', type: 'image', src: '/media/sunset.jpg', originalUrl: '/media/sunset.jpg', filename: 'sunset-walk.jpg' }]
  },
  {
    id: 'trip-to-paris', title: 'Trip to Paris', location: 'Paris, France', date: '2024-06-02',
    description: 'An unforgettable evening by the Eiffel Tower.', category: 'Travel', visibility: 'private', featured: true,
    cover: '/media/paris.jpg', assets: [{ id: 'a5', type: 'image', src: '/media/paris.jpg', originalUrl: '/media/paris.jpg', filename: 'trip-to-paris.jpg' }]
  },
  {
    id: 'quiet-evening', title: 'Quiet Evening', location: 'Home', date: '2024-01-14',
    description: 'The little everyday moments that feel like home.', category: 'Daily Life', visibility: 'private', featured: false,
    cover: '/media/home.jpg', assets: [{ id: 'a6', type: 'image', src: '/media/home.jpg', originalUrl: '/media/home.jpg', filename: 'quiet-evening.jpg' }]
  }
];

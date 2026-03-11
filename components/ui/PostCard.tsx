import { View, Image, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { Heart, MessageCircle } from 'lucide-react-native';

interface PostCardProps {
  id: number;
  image: any;
  height: number;
  likes: number;
  comments: number;
  liked: boolean;
  onLike: (id: number) => void;
}

export default function PostCard({
  id,
  image,
  height,
  likes,
  comments,
  liked,
  onLike,
}: PostCardProps) {
  return (
    <View style={styles.postContainer}>
      <Image
        source={image}
        style={[styles.postImage, { height }]}
        resizeMode="cover"
      />
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.actionButton} onPress={() => onLike(id)}>
          <Heart
            size={20}
            color={liked ? '#ff4757' : '#fff'}
            fill={liked ? '#ff4757' : 'transparent'}
          />
          <Text style={styles.actionText}>{likes}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <MessageCircle size={20} color="#fff" />
          <Text style={styles.actionText}>{comments}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  postContainer: {
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#f5f5f5',
    position: 'relative',
  },
  postImage: {
    width: '100%',
    backgroundColor: '#e0e0e0',
  },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

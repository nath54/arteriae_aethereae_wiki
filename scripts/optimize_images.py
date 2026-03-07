"""
This is an attempt about image optimization.
"""

# Import modules
from typing import Optional

import os
import random
import argparse

from PIL import Image  # type: ignore  # pylint: disable=import-error

from lib_color_tree_structure import Recursive3dTree


# Function to get color tuple from pixel access
def get_color_tuple(color_value: float | tuple[int, ...]) -> tuple[int, int, int]:
    """
    Ensure color value is tuple[int, int, int].

    Args:
        color_value (float | tuple[int, ...]): PixelAccess color value

    Returns:
        tuple[int, int, int]: Correct tuple format color
    """

    # Convert the color into RGB
    if isinstance(color_value, float):
        return (int(color_value), int(color_value), int(color_value))
    else:
        return (
            color_value[0],
            color_value[1],
            color_value[2],
        )


# Custom quantization image algorithm
def custom_quantization_algo(
    image: Image.Image,
    max_color_number: int = 20,
    tree_subdividing: int | list[int] = 4,
    tree_max_depth: int = 3,
    return_palette: bool = True,
) -> Image.Image:
    """
    Custom quantization Algorithm.

    Args:
        image (Image.Image): the image we are working one
        max_color_number (int): quantize down to that number of colors
        tree_subdividing (int | list[int]): How the tree subdividise
        tree_max_depth (int): How much depth the tree will have

    Returns:
        Image.Image: the final image
    """

    # Get the image data
    img_data: Optional[Image.core.PixelAccess] = image.load()  # pylint: disable=c-extension-no-member

    if img_data is None:
        raise ValueError("Error while getting pixel access image")

    # Create the tree structure to efficiently process the image colors
    cl_tree: Recursive3dTree = Recursive3dTree(
        start=(0, 0, 0),
        end=(256, 256, 256),
        parent=None,
        current_depth=0,
        dividing_factor=tree_subdividing,
        max_depth=tree_max_depth,
    )

    # We will also keep track of the final average color cluster for each initial color
    final_color_map: dict[tuple[int, int, int], tuple[int, int, int]] = {}

    # The tree will contain only the color cluster average position.
    # We will keep a set of currently active cluster centers
    active_clusters: set[tuple[int, int, int]] = set()

    # We will also keep track of how many pixels each color has to weight the averages
    color_counts: dict[tuple[int, int, int], int] = {}

    # Initially populate the tree from all the colors
    for x in range(0, image.size[0]):
        for y in range(0, image.size[1]):
            # Get the color
            cl: tuple[int, int, int] = get_color_tuple(img_data[x, y])

            # Add to frequencies mapping
            if cl not in color_counts:
                # Add the color to the tree
                cl_tree.add_color(cl)

                # Each color points to itself initially
                final_color_map[cl] = cl

                # Each color is it own cluster originally
                active_clusters.add(cl)

                # Starting count
                color_counts[cl] = 0

            color_counts[cl] += 1

    # Helper function to find the current active cluster for a given color
    def get_cluster(c: tuple[int, int, int]) -> tuple[int, int, int]:
        # Traverse the map to find the root cluster
        root = c
        while final_color_map[root] != root:
            root = final_color_map[root]

        # Path compression
        current = c
        while current != root:
            next_node = final_color_map[current]
            final_color_map[current] = root
            current = next_node

        return root

    # failure count to avoid infinite loops
    failure_count: int = 0
    max_failures: int = 100

    # In a first time,
    # we will randomly fuse two closest clusters
    while len(active_clusters) > max_color_number and failure_count < max_failures:
        print(len(active_clusters))

        # Get a random cluster color
        cluster_center: tuple[int, int, int] = random.sample(list(active_clusters), 1)[
            0
        ]

        # Get the closest other cluster from this key
        closest_cluster: Optional[tuple[int, int, int]] = cl_tree.get_closest_color(
            from_color=cluster_center, filter_color=set([cluster_center])
        )

        # Check for failure
        if closest_cluster is None:
            failure_count += 1
            continue

        # Get the pixel counts of the two merging clusters
        count_a = color_counts[cluster_center]
        count_b = color_counts[closest_cluster]
        total_pixels = count_a + count_b

        # Calculate the new weighted average center
        new_cluster_center_r = (
            cluster_center[0] * count_a + closest_cluster[0] * count_b
        ) / float(total_pixels)
        new_cluster_center_g = (
            cluster_center[1] * count_a + closest_cluster[1] * count_b
        ) / float(total_pixels)
        new_cluster_center_b = (
            cluster_center[2] * count_a + closest_cluster[2] * count_b
        ) / float(total_pixels)

        #
        new_cluster_center: tuple[int, int, int] = (
            int(new_cluster_center_r),
            int(new_cluster_center_g),
            int(new_cluster_center_b),
        )

        # Remove the old cluster points from the tree and set
        cl_tree.remove_color(cluster_center)
        cl_tree.remove_color(closest_cluster)
        active_clusters.remove(cluster_center)
        active_clusters.remove(closest_cluster)

        # Add the new cluster point in the tree and set
        cl_tree.add_color(new_cluster_center)
        active_clusters.add(new_cluster_center)
        color_counts[new_cluster_center] = total_pixels

        # Update the color mapping to point to the new cluster
        final_color_map[cluster_center] = new_cluster_center
        final_color_map[closest_cluster] = new_cluster_center
        final_color_map[new_cluster_center] = new_cluster_center

    # Flatten the tree mapping so it takes O(1) in the tight x/y image loop below
    for c in list(final_color_map.keys()):
        get_cluster(c)

    if not return_palette:
        # Just map directly and return the RGB image
        for x in range(0, image.size[0]):
            for y in range(0, image.size[1]):
                cl = get_color_tuple(img_data[x, y])
                if img_data is not None:
                    img_data[x, y] = final_color_map[cl]
        return image

    # Map the final colors
    # We will instantiate a new 'P' mode palette image for actual compression savings
    res_image = Image.new("P", image.size)
    res_data = res_image.load()

    unique_centers: list[tuple[int, int, int]] = list(active_clusters)
    palette: list[int] = []
    center_to_index: dict[tuple[int, int, int], int] = {}

    for i, center in enumerate(unique_centers):
        palette.extend(center)
        center_to_index[center] = i

    # PIL expects a 768-element list for an RGB palette (256 * 3)
    palette.extend([0] * (768 - len(palette)))
    res_image.putpalette(palette)

    for x in range(0, image.size[0]):
        for y in range(0, image.size[1]):
            # Get the color
            cl = get_color_tuple(img_data[x, y])

            # Update to the final mapped color palette index
            if res_data is not None:
                res_data[x, y] = center_to_index[final_color_map[cl]]

    return res_image


# Function to optimize an image
def optimize_image(
    input_file: str,
    output_file: str,
    max_image_size: int = 512,
    max_color_number: int = 20,
    tree_subdividing: int = 20,
    tree_max_depth: int = 5,
    algorithm: str = "custom",
) -> None:
    """
    Optimize an image.

    Args:

    """

    # Check if the input file exists
    if not os.path.exists(input_file):
        raise FileNotFoundError(f"Input file {input_file} does not exist.")

    # Open the image
    image: Image.Image = Image.open(input_file)

    print(f"DEBUG | Opened image {input_file}")

    # Ensure it is RGB
    image = image.convert("RGB")

    # Get width and weight
    img_width: int = image.size[0]
    img_height: int = image.size[1]

    # Initialize target image size variables if needed
    target_image_width: int = img_width
    target_image_height: int = img_height

    # Resize the image so the larger side is at maximum size if there is one larger
    if img_width > img_height and img_height > max_image_size:
        # Calculate the target image dimension to keep the same image ratio
        target_image_width = max_image_size
        target_image_height = int(max_image_size * (img_height / img_width))
        # Resize the image
        image = image.resize((target_image_width, target_image_height))
    # Other side part check
    elif img_width > max_image_size:
        # Calculate the target image dimension to keep the same image ratio
        target_image_width = int(max_image_size * (img_width / img_height))
        target_image_height = max_image_size
        # Resize the image
        image = image.resize((target_image_width, target_image_height))

    print(
        f"DEBUG | Image size ({img_width}, {img_height})"
        f" -> ({target_image_width}, {target_image_height})"
    )

    is_jpeg = output_file.lower().endswith((".jpg", ".jpeg"))

    #
    if algorithm == "custom":
        image = custom_quantization_algo(
            image=image,
            max_color_number=max_color_number,
            tree_subdividing=tree_subdividing,
            tree_max_depth=tree_max_depth,
            return_palette=not is_jpeg,
        )
    else:
        image = image.quantize(colors=max_color_number, method=Image.Quantize.MEDIANCUT)
        if is_jpeg:
            image = image.convert("RGB")

    # Save the image
    image.save(output_file, optimize=True)


# Entry point
if __name__ == "__main__":
    # Initialize the parser
    parser = argparse.ArgumentParser(description="Optimize images.")

    # Add arguments
    parser.add_argument(
        "-i", "--input", dest="input_file", type=str, help="Input file.", required=True
    )
    parser.add_argument(
        "-o",
        "--output",
        dest="output_file",
        type=str,
        help="Output file.",
        required=True,
    )
    parser.add_argument(
        "--size",
        type=int,
        default=256,
        help="Maximum image side size",
    )
    parser.add_argument(
        "--nb_cl",
        type=int,
        default=5,
        help="Maximum color in the optimized image",
    )
    parser.add_argument(
        "--div",
        type=int,
        nargs="+",
        default=[6, 4, 2],
        help="Color tree subdivisions at each level",
    )
    parser.add_argument(
        "--depth",
        type=int,
        default=2,
        help="Color tree depth",
    )
    parser.add_argument(
        "--algorithm",
        type=str,
        default="custom",
        help="Which quantization algorithm is used 'custom' or anything else -> not default",
    )

    # Parse arguments
    args = parser.parse_args()

    # Optimize the image
    optimize_image(
        input_file=args.input_file,
        output_file=args.output_file,
        max_image_size=args.size,
        max_color_number=args.nb_cl,
        tree_subdividing=args.div,
        tree_max_depth=args.depth,
        algorithm=args.algorithm,
    )

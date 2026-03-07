"""
This module contains the color tree structure used to optimize images.
"""

# Import Modules
from typing import Optional


# Function to calculate distance between colors
def cl_dist(
    cl1: tuple[int, int, int],
    cl2: tuple[int, int, int],
) -> float:
    """
    Calculate the distance between two colors.

    Args:
        cl1 (tuple[int, int, int]): The first color.
        cl2 (tuple[int, int, int]): The second color.

    Returns:
        float: The distance between the two colors.
    """

    # Calculate the distance between the two colors
    return sum((cl1[i] - cl2[i]) ** 2 for i in range(3)) ** 0.5


# Function to only calculate the surface coordinates of a 3d cube
def get_surface_coordinates_of_3d_cube(
    start: tuple[int, int, int],
    end: tuple[int, int, int],
    sub_block_size: tuple[int, int, int],
) -> list[tuple[int, int, int]]:
    """
    Get the surface coordinates of a 3d cube efficiently, without even looking at the inside.

    Args:
        start (tuple[int, int, int]): The start of the 3d cube.
        end (tuple[int, int, int]): The end of the 3d cube.
        sub_block_size (tuple[int, int, int]): The size of the sub-blocks.

    Returns:
        list[tuple[int, int, int]]: The surface coordinates of the 3d cube.
    """

    # Initialize the surface coordinates
    surface_coordinates: set[tuple[int, int, int]] = set()

    # Add the surface of the top of the 3d cube
    for x in range(start[0], end[0] + 1, sub_block_size[0]):
        for y in range(start[1], end[1] + 1, sub_block_size[1]):
            surface_coordinates.add((x, y, end[2]))

    # Add the surface of the bottom of the 3d cube
    for x in range(start[0], end[0] + 1, sub_block_size[0]):
        for y in range(start[1], end[1] + 1, sub_block_size[1]):
            surface_coordinates.add((x, y, start[2]))

    # Add the surface of the left of the 3d cube
    for y in range(start[1], end[1] + 1, sub_block_size[1]):
        for z in range(start[2], end[2] + 1, sub_block_size[2]):
            surface_coordinates.add((start[0], y, z))

    # Add the surface of the right of the 3d cube
    for y in range(start[1], end[1] + 1, sub_block_size[1]):
        for z in range(start[2], end[2] + 1, sub_block_size[2]):
            surface_coordinates.add((end[0], y, z))

    # Add the surface of the front of the 3d cube
    for x in range(start[0], end[0] + 1, sub_block_size[0]):
        for z in range(start[2], end[2] + 1, sub_block_size[2]):
            surface_coordinates.add((x, start[1], z))

    # Add the surface of the back of the 3d cube
    for x in range(start[0], end[0] + 1, sub_block_size[0]):
        for z in range(start[2], end[2] + 1, sub_block_size[2]):
            surface_coordinates.add((x, end[1], z))

    # Return the surface coordinates of the 3d cube
    return list(surface_coordinates)


# Recursive 3D Tree class
class Recursive3dTree:
    """
    This class represents a 3D tree that is used to divide a 3d space into smaller
    parts.

    We will use it in this application to efficiently store all the colors found in the image
    in a way we can easily cluster them so we can reduce the number of colors in the image,
    that would allow the compression of the image being more efficient, reducing the file size.
    (the tree will allow us to efficiently find a closest neighbor point
     from another point in the space)
    """

    def __init__(
        self,
        start: tuple[int, int, int],
        end: tuple[int, int, int],
        parent: Optional["Recursive3dTree"] = None,
        current_depth: int = 0,
        dividing_factor: int | list[int] = 10,
        max_depth: int = 5,
    ):

        # Start of the space managed from this tree branch
        self.start: tuple[int, int, int] = start

        # End of the space managed from this tree branch
        self.end: tuple[int, int, int] = end

        # Current depth of the current tree branch
        self.current_depth: int = current_depth

        # Factor by which the current space (end - start) will be divided here and for children
        self.dividing_factor: int | list[int] = dividing_factor

        # Size of the blocks managed from this tree branch
        self.block_size: tuple[int, int, int] = (
            (self.end[0] - self.start[0]) // self.crt_dividing_factor(),
            (self.end[1] - self.start[1]) // self.crt_dividing_factor(),
            (self.end[2] - self.start[2]) // self.crt_dividing_factor(),
        )

        # Max depth of the tree
        self.max_depth: int = max_depth

        # Parent of the current tree branch
        self.parent: Optional["Recursive3dTree"] = parent

        # Children of the current tree branch,
        # we will be adding / removing the tree branch dynamically
        self.children: dict[tuple[int, int, int], "Recursive3dTree"] = {}

        # Colors stored in the current tree branch (if this branch is a leaf)
        self.colors: Optional[set[tuple[int, int, int]]] = None

        # If this branch is a leaf, it will be True
        self.is_leaf: bool = self.current_depth >= self.max_depth

        # Number of colors stored in the current tree branch recursively
        self.color_count: int = 0

    def crt_dividing_factor(self) -> int:
        """
        Get current dividing factor
        """

        if isinstance(self.dividing_factor, int):
            return self.dividing_factor
        else:
            return self.dividing_factor[
                min(len(self.dividing_factor) - 1, self.current_depth)
            ]

    def check_if_color_is_inside_tree_space(
        self, color: tuple[int, int, int], raise_error: bool = True
    ) -> bool:
        """
        Check if the color is inside the space managed from this tree branch.

        Args:
            color (tuple[int, int, int]): The color to check.

        Returns:
            None
        """

        # Check if the color is inside the space managed from this tree branch
        if not (
            self.start[0] <= color[0] <= self.end[0]
            and self.start[1] <= color[1] <= self.end[1]
            and self.start[2] <= color[2] <= self.end[2]
        ):
            # Raise an error if asked
            if raise_error:
                raise ValueError(
                    "Color is not inside the space managed from this tree branch !"
                    "\n  - start of the space: "
                    f"{self.start}"
                    "\n  - end of the space: "
                    f"{self.end}"
                    "\n  - color: "
                    f"{color}"
                )

            # Return False if asked
            return False

        # Return True if asked
        return True

    def get_color_sub_block(self, color: tuple[int, int, int]) -> tuple[int, int, int]:
        """
        Get the sub-block of the color.

        Args:
            color (tuple[int, int, int]): The color to get the sub-block from.

        Returns:
            tuple[int, int, int]: The sub-block of the color.
        """

        # Get the sub-block of the color
        return (
            (color[0] // self.block_size[0]) * self.block_size[0],
            (color[1] // self.block_size[1]) * self.block_size[1],
            (color[2] // self.block_size[2]) * self.block_size[2],
        )

    def add_color(self, color: tuple[int, int, int]) -> None:
        """
        Add a color to the tree.

        Args:
            color (tuple[int, int, int]): The color to add.

        Returns:
            None
        """

        # Check if the color is inside the space managed from this tree branch
        self.check_if_color_is_inside_tree_space(color)

        # Increase the color count
        self.color_count += 1

        # If this branch is a leaf, add the color to it
        if self.is_leaf:
            # Check if the colors set is initialized
            if self.colors is None:
                # Initialize the colors set if it is not initialized
                self.colors = set()

            # Add the color to the colors set
            self.colors.add(color)

            # Return from the function, so the folowing code will be only for non leaf branches
            return

        # So if we are here, it means that this branch is not a leaf

        # Get the color branch sub-block coordinates
        sub_block_coordinate: tuple[int, int, int] = self.get_color_sub_block(color)

        # If the sub-block is not already a child of this branch, add it
        if sub_block_coordinate not in self.children:
            # Create the sub-block
            self.children[sub_block_coordinate] = Recursive3dTree(
                # Indicate the start of this sub-block
                start=sub_block_coordinate,
                # Calculate the end of this sub-block
                end=(
                    sub_block_coordinate[0] + self.block_size[0],
                    sub_block_coordinate[1] + self.block_size[1],
                    sub_block_coordinate[2] + self.block_size[2],
                ),
                # Indicate the parent of this sub-block
                parent=self,
                # Indicate the current depth of this sub-block
                current_depth=self.current_depth + 1,
                # Indicate the dividing factor of this sub-block
                dividing_factor=self.dividing_factor,
                # Indicate the max depth of this sub-block
                max_depth=self.max_depth,
            )

        # Add the color to the sub-block
        self.children[sub_block_coordinate].add_color(color)

    def remove_color(self, color: tuple[int, int, int]) -> bool:
        """
        Remove a color from the tree.

        Args:
            color (tuple[int, int, int]): The color to remove.

        Returns:
            bool: True if the color existed and was removed, False otherwise.
        """

        # Check if the color is inside the space managed from this tree branch
        if not self.check_if_color_is_inside_tree_space(color, raise_error=False):
            # The color is not inside this branch, so we can return from the function
            return False

        # If this branch is a leaf, remove the color from it
        if self.is_leaf:
            # Check if the colors set is initialized
            if self.colors is None:
                # The color is not inside this leaf, so we can return from the function
                return False

            # Check if the color is inside this leaf
            if color not in self.colors:
                # The color is not inside this leaf, so we can return from the function
                return False

            # Decrease the color count
            self.color_count -= 1

            # Remove the color from the colors set
            self.colors.remove(color)

            # Return from the function, so the folowing code will be only for non leaf branches
            return True

        # So if we are here, it means that this branch is not a leaf

        # Get the color branch sub-block coordinates
        sub_block_coordinate: tuple[int, int, int] = self.get_color_sub_block(color)

        # If the sub-block is not already a child of this branch, add it
        if sub_block_coordinate not in self.children:
            # The color is not inside any sub-block, so we can return from the function
            return False

        # Remove the color from the sub-block
        actually_deleted: bool = self.children[sub_block_coordinate].remove_color(color)

        #
        if actually_deleted:
            # Decrease the color count
            self.color_count -= 1

            # If the sub-block is empty, remove it
            if self.children[sub_block_coordinate].color_count == 0:
                del self.children[sub_block_coordinate]

        # Return from the function, so the folowing code will be only for non leaf branches
        return actually_deleted

    def __str__(self) -> str:
        return (
            "Recursive3dTree("
            f"\n\tstart={self.start},"
            f"\n\tend={self.end},"
            f"\n\tcurrent_depth={self.current_depth},"
            f"\n\tdividing_factor={self.dividing_factor},"
            f"\n\tmax_depth={self.max_depth},"
            f"\n\tparent={self.parent},"
            f"\n\tchildren={self.children},"
            f"\n\tcolors={self.colors},"
            f"\n\tis_leaf={self.is_leaf},"
            f"\n\tcolor_count={self.color_count}"
            "\n)"
        )

    def get_closest_color(
        self,
        from_color: tuple[int, int, int],
        filter_color: Optional[set[tuple[int, int, int]]] = None,
    ) -> Optional[tuple[int, int, int]]:
        """
        Get the closest color to the given color.

        Args:
            from_color (tuple[int, int, int]): The color to get the closest color to.
            filter_color (Optional[set[tuple[int, int, int]]]): The color to filter the
                                                                closest color by.
                                                                Defaults to None.

        Returns:
            Optional[tuple[int, int, int]]: The closest color to the given color if we found one.
        """

        # If this branch is a leaf, return the closest color from the colors set
        if self.is_leaf:
            # Check if the colors set is initialized
            if self.colors is None:
                # The colors set is not initialized, so we can return from the function
                return from_color

            # Filter out the colors we don't want
            potential_colors: list[tuple[int, int, int]] = [
                cl
                for cl in self.colors
                if filter_color is None or cl not in filter_color
            ]

            # If there are still colors
            if potential_colors:
                # We return the closest one
                return min(
                    potential_colors,
                    key=lambda color: cl_dist(from_color, color),
                )

            # No colors here after the filter
            return None

        # Else, we need to do a growing circular search until we find a closest color
        current_radius: int = 0
        radius_center: tuple[int, int, int] = self.get_color_sub_block(from_color)

        # To store a potential found closest color
        potential_closest_color: Optional[tuple[int, int, int]] = None
        potential_closest_color_distance: float = float("inf")

        # Get the yet unexplored sub-blocks
        unexplored_sub_blocks: set[tuple[int, int, int]] = set(self.children.keys())

        # While there are unexplored sub-blocks, we will increase the search radius
        while unexplored_sub_blocks:
            # Get the sub-blocks that are at the current radius from the radius center
            #  and check if they have a color in them
            # We want to only get the circular sub-blocks surface, not the already explored inside
            surface_sub_blocks: list[tuple[int, int, int]] = (
                get_surface_coordinates_of_3d_cube(
                    start=(
                        radius_center[0] - current_radius * self.block_size[0],
                        radius_center[1] - current_radius * self.block_size[1],
                        radius_center[2] - current_radius * self.block_size[2],
                    ),
                    end=(
                        radius_center[0] + current_radius * self.block_size[0],
                        radius_center[1] + current_radius * self.block_size[1],
                        radius_center[2] + current_radius * self.block_size[2],
                    ),
                    sub_block_size=self.block_size,
                )
            )

            # For each sub-block at the current radius, check if it has a color in it
            for bx, by, bz in surface_sub_blocks:
                # If the sub-block is not in the unexplored sub-blocks set, we can skip it
                if (bx, by, bz) not in unexplored_sub_blocks:
                    continue

                # We explored it, we can remove it from the unexplored sub-blocks
                unexplored_sub_blocks.remove((bx, by, bz))

                # Get the closest color from the sub-block
                closest_color_from_block: Optional[tuple[int, int, int]] = (
                    self.children[(bx, by, bz)].get_closest_color(
                        from_color=from_color,
                        filter_color=filter_color,
                    )
                )

                # If we didn't find a closest color, we can continue to the next sub-block
                if closest_color_from_block is None:
                    continue

                # Calculate the distance from the closest color
                closest_color_from_block_distance: float = cl_dist(
                    from_color, closest_color_from_block
                )

                # Check if the closest color is closer than the potential closest color
                if closest_color_from_block_distance < potential_closest_color_distance:
                    # Update the potential closest color
                    potential_closest_color = closest_color_from_block
                    potential_closest_color_distance = closest_color_from_block_distance

            # If we found a closest color, we can return it
            if potential_closest_color is not None:
                return potential_closest_color

            # Increase the radius
            current_radius += 1

        # We didn't find any closest color, so we can return from the function
        return None
